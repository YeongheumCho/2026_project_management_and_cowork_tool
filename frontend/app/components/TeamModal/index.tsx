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
  type UserBrief,
} from '../../lib/api';
import Modal from '../Modal';
import ProgressBar from '../ProgressBar';
import ModalFooter from './parts/ModalFooter';
import ModalHeader from './parts/ModalHeader';
import BasicSection from './sections/BasicSection';
import CustomFieldsSection from './sections/CustomFieldsSection';
import { buildSubProjectPayload } from './payload';
import { EMPTY_FORM, fromSubProject, type FormState } from './types';
import {
  isTemplateForMajorProject,
  projectTemplatePrefix,
} from '../../lib/templateScope';

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

const FIELD_SCHEMA_NAME_KEY = '__field_schema_name';
const LEGACY_FIELD_SCHEMA_TYPE_KEY = '__field_schema_type';

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
  const [fieldSchemas, setFieldSchemas] = useState<Record<string, ProjectFieldSchema>>({});
  const [selectedFieldSchemaType, setSelectedFieldSchemaType] =
    useState('general');

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === f.projectId),
    [projects, f.projectId],
  );
  const initialProject = useMemo(
    () =>
      initial
        ? projects.find((project) => project.id === initial.project_id) ?? null
        : null,
    [initial, projects],
  );
  const projectType = selectedProject?.project_type ?? 'general';
  const fieldSchemaType = selectedFieldSchemaType;
  const fieldSchemaOptions = useMemo(
    () =>
      selectedProject
        ? orderedFieldSchemas(fieldSchemas, selectedProject, projects)
        : [],
    [fieldSchemas, projects, selectedProject],
  );
  const effectiveSchema = useMemo(
    () => effectiveFieldSchema(
      fieldSchemas[fieldSchemaType] ??
        fieldSchemaOptions[0] ??
        emptyProjectTemplateSchema(selectedProject?.id ?? 0),
    ),
    [fieldSchemaOptions, fieldSchemaType, fieldSchemas, selectedProject?.id],
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
  const availableFunctionOwnerIds = useMemo(
    () => new Set(projectParticipants.map((user) => String(user.id))),
    [projectParticipants],
  );
  const fieldValues = useMemo(() => getFieldValues(f), [f]);
  const requiredFieldMissing = effectiveSchema.fields.some(
    (field) => field.required && !fieldValues[field.key]?.trim(),
  );

  useEffect(() => {
    if (!open) return;
    if (mode === 'edit' && initial) {
      setF(fromSubProject(initial));
    } else {
      const initProjectId = lockedProjectId ?? projects[0]?.id ?? '';
      const initProject =
        typeof initProjectId === 'number'
          ? projects.find((p) => p.id === initProjectId)
          : undefined;
      setF({
        ...EMPTY_FORM,
        projectId: initProjectId,
        startDate: defaultDate ?? initProject?.start_date ?? '',
        endDate: defaultDate ?? initProject?.end_date ?? '',
      });
    }
    setError('');
  }, [open, mode, initial, defaultDate, projects, lockedProjectId]);

  useEffect(() => {
    if (!open) return;
    apiFetch<ProjectFieldSchema[]>('/field-schemas')
      .then((saved) => {
        setFieldSchemas(
          Object.fromEntries(
            saved.map((schema) => [String(schema.project_type), schema]),
          ),
        );
      })
      .catch(() => {
        setFieldSchemas({});
      });
  }, [open]);

  useEffect(() => {
    if (!open || mode !== 'create') return;
    const nextSchema = fieldSchemaOptions[0];
    if (!nextSchema) {
      setSelectedFieldSchemaType('');
      setF((prev) => ({
        ...prev,
        name: '',
        customFields: withoutFieldSchemaMeta(prev.customFields),
      }));
      return;
    }
    setSelectedFieldSchemaType(String(nextSchema.project_type));
    const templateName = nextSchema.section_label;
    const templateWeight = nextSchema.weight ?? 5;
    setF((prev) => ({
      ...applyFieldDefaults(prev, nextSchema, false),
      name:
        selectedProject?.vehicle_sets?.length
          ? prev.name
          : templateName,
      weight: templateWeight,
    }));
  }, [fieldSchemaOptions, mode, open, projectType, selectedProject?.vehicle_sets?.length]);

  useEffect(() => {
    if (!open || mode !== 'edit' || !initial) return;
    const inferredType = inferFieldSchemaType(
      initial,
      fieldSchemas,
      selectedProject ?? initialProject,
      projects,
      projectType,
    );
    setSelectedFieldSchemaType(inferredType);
    setF((prev) => ({
      ...prev,
      customFields: {
        ...withoutFieldSchemaMeta(prev.customFields),
        [FIELD_SCHEMA_NAME_KEY]: templateNameForType(inferredType, fieldSchemas),
      },
    }));
  }, [fieldSchemas, initial, initialProject, mode, open, projectType, projects, selectedProject]);

  useEffect(() => {
    if (f.assigneeIds.length === 0) return;
    const nextAssigneeIds = f.assigneeIds.filter((id) =>
      availableAssigneeIds.has(id),
    );
    if (nextAssigneeIds.length === f.assigneeIds.length) return;
    setF((prev) => ({
      ...prev,
      assigneeIds: nextAssigneeIds,
      assigneeId: nextAssigneeIds[0] ?? '',
    }));
  }, [availableAssigneeIds, f.assigneeIds]);

  useEffect(() => {
    if (!f.functionOwner.trim()) return;
    if (availableFunctionOwnerIds.has(f.functionOwner)) return;
    setF((prev) => ({ ...prev, functionOwner: '' }));
  }, [availableFunctionOwnerIds, f.functionOwner]);

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

  const outsideProjectRange =
    !!selectedProject &&
    ((!!selectedProject.start_date && !!f.startDate && f.startDate < selectedProject.start_date) ||
      (!!selectedProject.end_date && !!f.endDate && f.endDate > selectedProject.end_date));

  const invalid =
    !f.name.trim() ||
    (mode === 'create' && fieldSchemaOptions.length === 0) ||
    !f.projectId ||
    f.assigneeIds.length === 0 ||
    !f.startDate ||
    !f.endDate ||
    f.endDate < f.startDate ||
    outsideProjectRange ||
    requiredFieldMissing;

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setF((prev) => ({ ...prev, [key]: value }));

  const handleFieldSchemaTypeChange = (nextType: string) => {
    setSelectedFieldSchemaType(nextType);
    const templateName = templateNameForType(nextType, fieldSchemas);
    const templateWeight = fieldSchemas[nextType]?.weight ?? 5;
    const schema = fieldSchemas[nextType];
    setF((prev) => ({
      ...(schema ? applyFieldDefaults(prev, schema, true) : prev),
      name:
        mode === 'create' && selectedProject?.vehicle_sets?.length
          ? prev.name
          : templateName,
      weight: templateWeight,
    }));
  };

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
        value: String(user.id),
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
          mode === 'edit' && isAdmin
        }
        onDelete={handleDelete}
      />

      {!isAdmin && (
        <p className="mt-3 rounded-xl bg-verify-warn-bg px-4 py-3 text-sm text-verify-warn-fg">
          {TEXT.adminOnly}
        </p>
      )}

      {mode === 'edit' && initial && (
        <ProgressSummary subproject={initial} />
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
          fieldSchema={effectiveSchema}
          fieldSchemaOptions={fieldSchemaOptions}
          selectedFieldSchemaType={selectedFieldSchemaType}
          onFieldSchemaTypeChange={handleFieldSchemaTypeChange}
        />

        <CustomFieldsSection
          schema={effectiveSchema}
          values={fieldValues}
          optionsForField={optionsForField}
          onChange={updateDynamicField}
          disabled={!isAdmin}
        />

        {error && (
          <p className="rounded-xl bg-verify-fail-bg px-4 py-3 text-sm text-verify-fail-fg">
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

function ProgressSummary({ subproject }: { subproject: SubProject }) {
  const progress = Math.min(100, Math.max(0, subproject.progress ?? 0));
  const doneTasks = subproject.subtasks.filter((task) => task.is_done).length;
  const totalTasks = subproject.subtasks.length;

  return (
    <section className="mt-4 rounded-xl border border-border bg-surface-muted p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-text-subtle">진행률</p>
          <p className="mt-1 text-lg font-bold text-text">{Math.round(progress)}%</p>
        </div>
        <p className="text-xs font-medium text-text-muted">
          {subproject.start_date} - {subproject.end_date}
          {totalTasks > 0 ? ` · 세부 항목 ${doneTasks}/${totalTasks}` : ''}
        </p>
      </div>
      <ProgressBar
        value={progress}
        className="mt-3"
        ariaLabel={`${subproject.name} 진행률`}
      />
    </section>
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

function inferFieldSchemaType(
  subproject: SubProject,
  fieldSchemas: Record<string, ProjectFieldSchema>,
  project: Project | null,
  projects: Project[],
  fallbackType: string,
) {
  const projectSchemas = project ? orderedFieldSchemas(fieldSchemas, project, projects) : [];
  const savedName = subproject.custom_fields?.[FIELD_SCHEMA_NAME_KEY];
  if (typeof savedName === 'string' && savedName) {
    const typeByName = typeForTemplateName(savedName, projectSchemas);
    if (typeByName) return typeByName;
  }

  const legacySavedType = subproject.custom_fields?.[LEGACY_FIELD_SCHEMA_TYPE_KEY];
  if (
    typeof legacySavedType === 'string' &&
    projectSchemas.some((schema) => schema.project_type === legacySavedType)
  ) {
    return legacySavedType;
  }

  const fieldValues = getFieldValues(fromSubProject(subproject));
  const populatedKeys = new Set(
    Object.entries(fieldValues)
      .filter(([key, value]) =>
        key !== FIELD_SCHEMA_NAME_KEY &&
        key !== LEGACY_FIELD_SCHEMA_TYPE_KEY &&
        value.trim() !== '',
      )
      .map(([key]) => key),
  );
  if (populatedKeys.size === 0) {
    return String(projectSchemas[0]?.project_type ?? fallbackType);
  }

  let bestType = String(projectSchemas[0]?.project_type ?? fallbackType);
  let bestScore = 0;
  for (const schema of projectSchemas) {
    const score = schema.fields.reduce(
      (sum, field) => sum + (populatedKeys.has(field.key) ? 1 : 0),
      0,
    );
    if (score > bestScore) {
      bestType = String(schema.project_type);
      bestScore = score;
    }
  }
  return bestType;
}

function templateNameForType(
  projectType: string,
  fieldSchemas: Record<string, ProjectFieldSchema>,
) {
  return (
    fieldSchemas[projectType]?.section_label ||
    defaultFieldSchema(projectType).section_label
  );
}

function typeForTemplateName(
  templateName: string,
  schemas: ProjectFieldSchema[],
) {
  return String(
    schemas.find((schema) => schema.section_label === templateName)?.project_type ?? '',
  ) || null;
}

function withoutFieldSchemaMeta(fields: Record<string, string>) {
  const next = { ...fields };
  delete next[FIELD_SCHEMA_NAME_KEY];
  delete next[LEGACY_FIELD_SCHEMA_TYPE_KEY];
  return next;
}

function applyFieldDefaults(
  draft: FormState,
  schema: ProjectFieldSchema,
  overwrite: boolean,
): FormState {
  const next: FormState = {
    ...draft,
    customFields: {
      ...withoutFieldSchemaMeta(draft.customFields),
      [FIELD_SCHEMA_NAME_KEY]: schema.section_label,
    },
  };

  for (const field of schema.fields) {
    const value = field.default_value ?? '';
    if (value === '') continue;

    const currentValue = getFieldValues(next)[field.key] ?? '';
    if (!overwrite && currentValue.trim() !== '') continue;
    setFieldOnDraft(next, field.key, value);
  }

  return next;
}

function emptyProjectTemplateSchema(projectId: number): ProjectFieldSchema {
  return {
    id: 0,
    project_type: projectId ? `${projectTemplatePrefix(projectId)}empty` : '',
    section_label: '템플릿 없음',
    fields: [],
    weight: 5,
    created_by: null,
    updated_at: '',
  };
}

function orderedFieldSchemas(
  fieldSchemas: Record<string, ProjectFieldSchema>,
  project: Project,
  projects: Project[],
) {
  const scopedTemplates = Object.values(fieldSchemas).filter(
    (schema) =>
      project.major_project_id !== null &&
      project.major_project_id !== undefined &&
      isTemplateForMajorProject(schema, project.major_project_id),
  );
  const legacyProjectIds = projects
    .filter((item) => item.major_project_id === project.major_project_id)
    .map((item) => item.id);
  const legacyTemplates = Object.values(fieldSchemas).filter((schema) =>
    legacyProjectIds.some((projectId) =>
      String(schema.project_type).startsWith(projectTemplatePrefix(projectId)),
    ),
  );
  return (scopedTemplates.length > 0 ? scopedTemplates : legacyTemplates)
    .sort((left, right) =>
      left.section_label.localeCompare(right.section_label, 'ko-KR'),
    );
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
