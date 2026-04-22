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
    if (!window.confirm('Delete this subproject?')) return;

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
      ariaLabel={mode === 'create' ? 'Add subproject' : 'Edit subproject'}
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
          Only admins can create or edit subprojects here.
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
