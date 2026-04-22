'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  apiFetch,
  type Project,
  type SubProject,
  type UserBrief,
} from '../../lib/api';
import Modal from '../Modal';
import ModalHeader from './parts/ModalHeader';
import ModalFooter from './parts/ModalFooter';
import BasicSection from './sections/BasicSection';
import InspectionMetaSection from './sections/InspectionMetaSection';
import InspectionStatusSection from './sections/InspectionStatusSection';
import ChangeSection from './sections/ChangeSection';
import EtcSection from './sections/EtcSection';
import { EMPTY_FORM, fromSubProject, type FormState } from './types';
import { buildSubProjectPayload } from './payload';

type Props = {
  open: boolean;
  mode: 'create' | 'edit';
  isAdmin: boolean;
  users: UserBrief[];
  projects: Project[];
  defaultDate?: string;
  lockedProjectId?: number;
  initial?: SubProject | null;
  onClose: () => void;
  onSaved: () => void;
};

/**
 * 관리자가 소프로젝트(SubProject)를 생성/수정하는 모달.
 * 각 섹션은 독립 파일로 분리되어 있어 병합 충돌을 최소화한다:
 *  - sections/BasicSection        : 공통 기본
 *  - sections/InspectionMetaSection : 검증 공통 메타
 *  - sections/InspectionStatusSection : 1차 검증 / InReview
 *  - sections/ChangeSection       : 변경점 검증
 *  - sections/EtcSection          : 기타 업무
 *  - parts/InspectionBlock, ModalHeader, ModalFooter
 *  - types, payload               : 상태/직렬화
 */
export default function TeamModal({
  open,
  mode,
  isAdmin,
  users,
  projects,
  defaultDate,
  lockedProjectId,
  initial,
  onClose,
  onSaved,
}: Props) {
  const [f, setF] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    if (mode === 'edit' && initial) {
      setF(fromSubProject(initial));
    } else {
      setF({
        ...EMPTY_FORM,
        projectId: lockedProjectId ?? projects[0]?.id ?? '',
        startDate: defaultDate ?? '',
        endDate: defaultDate ?? '',
      });
    }
    setError('');
  }, [open, mode, initial, defaultDate, projects, lockedProjectId]);

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === f.projectId),
    [projects, f.projectId],
  );
  const projectType = selectedProject?.project_type ?? 'general';
  const isInspection =
    projectType === 'official_inspection' ||
    projectType === 'regular_inspection' ||
    projectType === 'change_inspection';
  const isChange = projectType === 'change_inspection';
  const isOfficial = projectType === 'official_inspection';
  const isEtc = projectType === 'etc_task';

  const invalid =
    !f.name.trim() ||
    !f.projectId ||
    !f.assigneeId ||
    !f.startDate ||
    !f.endDate ||
    f.endDate < f.startDate;

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setF((prev) => ({ ...prev, [key]: value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    if (invalid) return;
    setSaving(true);
    setError('');
    try {
      const payload = buildSubProjectPayload(f);
      if (mode === 'create') {
        await apiFetch('/subprojects', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      } else if (initial) {
        const { project_id: _pid, ...updatable } = payload;
        await apiFetch(`/subprojects/${initial.id}`, {
          method: 'PUT',
          body: JSON.stringify(updatable),
        });
      }
      onSaved();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!initial || !isAdmin) return;
    if (initial.status === 'completed') return;
    if (!window.confirm('이 소프로젝트를 삭제할까요?')) return;
    setSaving(true);
    setError('');
    try {
      await apiFetch(`/subprojects/${initial.id}`, { method: 'DELETE' });
      onSaved();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      scrollable
      ariaLabel={mode === 'create' ? '소프로젝트 추가' : '소프로젝트 수정'}
    >
      <ModalHeader
        mode={mode}
        selectedProject={selectedProject}
        canDelete={
          mode === 'edit' && isAdmin && initial?.status !== 'completed'
        }
        onDelete={handleDelete}
      />

      {!isAdmin && (
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
          이 화면은 관리자만 수정할 수 있습니다.
        </p>
      )}

      <form onSubmit={submit} className="mt-4 space-y-5">
        <BasicSection
          f={f}
          set={set}
          users={users}
          projects={projects}
          isAdmin={isAdmin}
          mode={mode}
          lockedProjectId={lockedProjectId}
          isEtc={isEtc}
        />

        {isInspection && (
          <>
            <InspectionMetaSection
              f={f}
              set={set}
              users={users}
              isOfficial={isOfficial}
            />
            <InspectionStatusSection f={f} set={set} />
          </>
        )}

        {isChange && <ChangeSection f={f} set={set} />}

        {isEtc && <EtcSection f={f} set={set} />}

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}

        <ModalFooter
          mode={mode}
          saving={saving}
          invalid={invalid}
          isAdmin={isAdmin}
          onCancel={onClose}
        />
      </form>
    </Modal>
  );
}
