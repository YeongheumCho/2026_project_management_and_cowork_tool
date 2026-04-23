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

const TEXT = {
  deleteConfirm:
    '\uc774 \ud558\uc704 \ud504\ub85c\uc81d\ud2b8\ub97c \uc0ad\uc81c\ud558\uc2dc\uaca0\uc2b5\ub2c8\uae4c?',
  createAria: '\ud558\uc704 \ud504\ub85c\uc81d\ud2b8 \ucd94\uac00',
  editAria: '\ud558\uc704 \ud504\ub85c\uc81d\ud2b8 \uc218\uc815',
  adminOnly:
    '\uc5ec\uae30\uc11c\ub294 \uad00\ub9ac\uc790\ub9cc \ud558\uc704 \ud504\ub85c\uc81d\ud2b8\ub97c \ucd94\uac00\ud558\uac70\ub098 \uc218\uc815\ud560 \uc218 \uc788\uc2b5\ub2c8\ub2e4.',
} as const;

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
    () => projects.find((project) => project.id === f.projectId),
    [projects, f.projectId],
  );
  const availableAssigneeIds = useMemo(() => {
    if (!selectedProject || selectedProject.participants.length === 0) {
      return new Set(users.map((user) => user.id));
    }
    return new Set(selectedProject.participants.map((user) => user.id));
  }, [selectedProject, users]);

  useEffect(() => {
    if (f.assigneeId === '') return;
    if (availableAssigneeIds.has(f.assigneeId)) return;
    setF((prev) => ({ ...prev, assigneeId: '' }));
  }, [availableAssigneeIds, f.assigneeId]);

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

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!isAdmin || invalid) return;

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
        const updatable = { ...payload, project_id: undefined };

        await apiFetch(`/subprojects/${initial.id}`, {
          method: 'PUT',
          body: JSON.stringify(updatable),
        });
      }

      onSaved();
      onClose();
    } catch (nextError) {
      setError((nextError as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!initial || !isAdmin) return;
    if (initial.status === 'completed') return;
    if (!window.confirm(TEXT.deleteConfirm)) return;

    setSaving(true);
    setError('');

    try {
      await apiFetch(`/subprojects/${initial.id}`, { method: 'DELETE' });
      onSaved();
      onClose();
    } catch (nextError) {
      setError((nextError as Error).message);
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
      ariaLabel={mode === 'create' ? TEXT.createAria : TEXT.editAria}
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
        <p className="mt-3 rounded-xl bg-[#FAEEDA] px-4 py-3 text-sm text-[#854F0B]">
          {TEXT.adminOnly}
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
          <p className="rounded-xl bg-[#FCEBEB] px-4 py-3 text-sm text-[#A32D2D]">
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
