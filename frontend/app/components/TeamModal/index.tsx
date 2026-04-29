'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  apiFetch,
  defaultFieldSchema,
  effectiveFieldSchema,
  type FieldDefinition,
  type FieldOption,
  type Project,
  type ProjectFieldSchema,
  type SubProject,
  type Template,
  type UserBrief,
} from '../../lib/api';
import Modal from '../Modal';
import ModalFooter from './parts/ModalFooter';
import ModalHeader from './parts/ModalHeader';
import BasicSection from './sections/BasicSection';
import CustomFieldsSection from './sections/CustomFieldsSection';
import { buildSubProjectPayload } from './payload';
import { EMPTY_FORM, fromSubProject, type FormState } from './types';

const TEXT = {
  deleteConfirm: '이 하위 프로젝트를 삭제하시겠습니까?',
  createAria: '하위 프로젝트 추가',
  editAria: '하위 프로젝트 수정',
  adminOnly:
    '여기서는 관리자만 하위 프로젝트를 추가하거나 수정할 수 있습니다.',
} as const;

const SYSTEM_FIELD_MAP: Record<string, keyof FormState> = {
  priority: 'priority',
  controller_name: 'controllerName',
  controller_version: 'controllerVersion',
  controller_country: 'controllerCountry',
  to_number: 'toNumber',
  to_assignee: 'toAssignee',
  verification_level: 'verificationLevel',
  vehicle_type: 'vehicleType',
  completed_on: 'completedOn',
  function_name: 'functionName',
  function_owner: 'functionOwner',
  verifier_id: 'verifierId',
  reviewer_id: 'reviewerId',
  seat_no: 'seatNo',
  controller_no: 'controllerNo',
  avg_expected_minutes: 'avgExpectedMinutes',
  issue_note: 'issueNote',
  upload_done: 'uploadDone',
  special_note: 'specialNote',
  first_verify_status: 'firstVerifyStatus',
  first_setup_min: 'firstSetupMin',
  first_aud_min: 'firstAudMin',
  first_review_min: 'firstReviewMin',
  inreview_status: 'inreviewStatus',
  inreview_setup_min: 'inreviewSetupMin',
  inreview_aud_min: 'inreviewAudMin',
  inreview_feedback_min: 'inreviewFeedbackMin',
  cr_no: 'crNo',
  ip_addr: 'ipAddr',
  change_feedback_min: 'changeFeedbackMin',
  change_revalidate_min: 'changeRevalidateMin',
  lin_std_hold_note: 'linStdHoldNote',
  etc_category: 'etcCategory',
  etc_month: 'etcMonth',
  etc_days: 'etcDays',
  etc_note: 'etcNote',
};

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
  const [templates, setTemplates] = useState<Template[]>([]);
  const [fieldSchema, setFieldSchema] = useState<ProjectFieldSchema | null>(null);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === f.projectId),
    [projects, f.projectId],
  );
  const projectType = selectedProject?.project_type ?? 'general';
  const effectiveSchema = useMemo(
    () =>
      fieldSchema
        ? effectiveFieldSchema(fieldSchema)
        : defaultFieldSchema(projectType),
    [fieldSchema, projectType],
  );
  const projectParticipants = useMemo(
    () => selectedProject?.participants ?? [],
    [selectedProject],
  );
  const availableAssigneeIds = useMemo(() => {
    if (!selectedProject || selectedProject.participants.length === 0) {
      return new Set(users.map((user) => user.id));
    }
    return new Set(selectedProject.participants.map((user) => user.id));
  }, [selectedProject, users]);
  const availableFunctionOwnerNames = useMemo(
    () => new Set(projectParticipants.map((user) => user.name)),
    [projectParticipants],
  );
  const filteredTemplates = useMemo(() => {
    if (!selectedProject) return [];
    return templates.filter(
      (template) => template.project_type === selectedProject.project_type,
    );
  }, [selectedProject, templates]);

  const fieldValues = useMemo(() => getFieldValues(f), [f]);
  const requiredFieldMissing = effectiveSchema.fields.some(
    (field) => field.required && !fieldValues[field.key]?.trim(),
  );

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

  useEffect(() => {
    if (!open || mode !== 'create') return;
    apiFetch<Template[]>('/templates')
      .then(setTemplates)
      .catch(() => setTemplates([]));
  }, [open, mode]);

  useEffect(() => {
    if (!open || !selectedProject) {
      setFieldSchema(null);
      return;
    }
    const nextProjectType = selectedProject.project_type;
    apiFetch<ProjectFieldSchema>(`/field-schemas/${nextProjectType}`)
      .then(setFieldSchema)
      .catch(() => setFieldSchema(defaultFieldSchema(nextProjectType)));
  }, [open, selectedProject]);

  useEffect(() => {
    if (f.assigneeId === '') return;
    if (availableAssigneeIds.has(f.assigneeId)) return;
    setF((prev) => ({ ...prev, assigneeId: '' }));
  }, [availableAssigneeIds, f.assigneeId]);

  useEffect(() => {
    if (!f.functionOwner.trim()) return;
    if (availableFunctionOwnerNames.has(f.functionOwner)) return;
    setF((prev) => ({ ...prev, functionOwner: '' }));
  }, [availableFunctionOwnerNames, f.functionOwner]);

  useEffect(() => {
    if (f.verifierId === '') return;
    if (availableAssigneeIds.has(f.verifierId)) return;
    setF((prev) => ({ ...prev, verifierId: '' }));
  }, [availableAssigneeIds, f.verifierId]);

  useEffect(() => {
    if (f.reviewerId === '') return;
    if (availableAssigneeIds.has(f.reviewerId)) return;
    setF((prev) => ({ ...prev, reviewerId: '' }));
  }, [availableAssigneeIds, f.reviewerId]);

  const invalid =
    !f.name.trim() ||
    !f.projectId ||
    !f.assigneeId ||
    !f.startDate ||
    !f.endDate ||
    f.endDate < f.startDate ||
    requiredFieldMissing;

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setF((prev) => ({ ...prev, [key]: value }));

  function applyTemplate(fields: Record<string, unknown>) {
    setF((prev) => {
      const next: FormState = { ...prev, customFields: { ...prev.customFields } };
      for (const [key, value] of Object.entries(fields)) {
        setFieldOnDraft(next, key, value == null ? '' : String(value));
      }
      return next;
    });
  }

  function updateDynamicField(key: string, value: string) {
    setF((prev) => {
      const next: FormState = { ...prev, customFields: { ...prev.customFields } };
      setFieldOnDraft(next, key, value);
      return next;
    });
  }

  function optionsForField(field: FieldDefinition): FieldOption[] | undefined {
    if (field.options.length > 0) return field.options;
    if (field.key === 'function_owner') {
      return projectParticipants.map((user) => ({
        value: user.name,
        label: user.name,
      }));
    }
    if (field.key === 'verifier_id' || field.key === 'reviewer_id') {
      return projectParticipants.map((user) => ({
        value: String(user.id),
        label: user.name,
      }));
    }
    return undefined;
  }

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
          isEtc={projectType === 'etc_task'}
          templates={filteredTemplates}
          onApplyTemplate={applyTemplate}
        />

        <CustomFieldsSection
          schema={effectiveSchema}
          values={fieldValues}
          optionsForField={optionsForField}
          onChange={updateDynamicField}
          disabled={!isAdmin}
        />

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

function getFieldValues(f: FormState): Record<string, string> {
  return {
    ...f.customFields,
    priority: f.priority,
    controller_name: f.controllerName,
    controller_version: f.controllerVersion,
    controller_country: f.controllerCountry,
    to_number: f.toNumber,
    to_assignee: f.toAssignee,
    verification_level: f.verificationLevel,
    vehicle_type: f.vehicleType,
    completed_on: f.completedOn,
    function_name: f.functionName,
    function_owner: f.functionOwner,
    verifier_id: f.verifierId === '' ? '' : String(f.verifierId),
    reviewer_id: f.reviewerId === '' ? '' : String(f.reviewerId),
    seat_no: f.seatNo,
    controller_no: f.controllerNo,
    avg_expected_minutes: f.avgExpectedMinutes,
    issue_note: f.issueNote,
    upload_done: f.uploadDone ? 'true' : 'false',
    special_note: f.specialNote,
    first_verify_status: f.firstVerifyStatus,
    first_setup_min: f.firstSetupMin,
    first_aud_min: f.firstAudMin,
    first_review_min: f.firstReviewMin,
    inreview_status: f.inreviewStatus,
    inreview_setup_min: f.inreviewSetupMin,
    inreview_aud_min: f.inreviewAudMin,
    inreview_feedback_min: f.inreviewFeedbackMin,
    cr_no: f.crNo,
    ip_addr: f.ipAddr,
    change_feedback_min: f.changeFeedbackMin,
    change_revalidate_min: f.changeRevalidateMin,
    lin_std_hold_note: f.linStdHoldNote,
    etc_category: f.etcCategory,
    etc_month: f.etcMonth,
    etc_days: f.etcDays,
    etc_note: f.etcNote,
  };
}

function setFieldOnDraft(draft: FormState, key: string, value: string) {
  const formKey = SYSTEM_FIELD_MAP[key];
  if (!formKey) {
    draft.customFields[key] = value;
    return;
  }

  if (formKey === 'uploadDone') {
    draft.uploadDone = value === 'true';
    return;
  }
  if (formKey === 'verifierId' || formKey === 'reviewerId') {
    draft[formKey] = value === '' ? '' : Number(value);
    return;
  }

  (draft[formKey] as string) = value;
}
