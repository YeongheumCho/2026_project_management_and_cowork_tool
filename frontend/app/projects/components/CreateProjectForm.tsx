'use client';

import { FormEvent, type ReactNode, useEffect, useMemo, useState } from 'react';
import OrganizationMemberPicker from '../../components/OrganizationMemberPicker';
import {
  apiFetch,
  defaultFieldSchema,
  PROJECT_TYPE_LABEL,
  PROJECT_TYPE_OPTIONS,
  type MajorProject,
  type Project,
  type ProjectType,
  type ProjectVehicleSet,
} from '../../lib/api';
import { clampDateYear, MAX_DATE_VALUE } from '../../lib/dateInput';
import VehicleSetEditor, { normalizeVehicleSets } from './VehicleSetEditor';

type Props = {
  majorProjects: MajorProject[];
  onCreated: (project: Project) => void;
  onError: (msg: string) => void;
};

const controlClass =
  'mt-1 h-10 w-full rounded-lg border border-border px-3 py-2 text-sm';

export default function CreateProjectForm({ majorProjects, onCreated, onError }: Props) {
  const initialMajorProjectId = majorProjects[0]?.id ?? '';
  const [majorProjectId, setMajorProjectId] = useState<number | ''>(initialMajorProjectId);
  const [name, setName] = useState('');
  const [type, setType] = useState<ProjectType>('official_inspection');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [vehicleSets, setVehicleSets] = useState<ProjectVehicleSet[]>([]);
  const [participantIds, setParticipantIds] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (majorProjectId === '' && majorProjects.length > 0) {
      setMajorProjectId(majorProjects[0].id);
    }
  }, [majorProjectId, majorProjects]);
  const selectedMajorProject = useMemo(
    () => majorProjects.find((item) => item.id === majorProjectId) ?? null,
    [majorProjectId, majorProjects],
  );
  const selectableUsers = selectedMajorProject?.members ?? [];
  const availableProjectTypes = useMemo(
    () =>
      selectedMajorProject?.project_types?.length
        ? selectedMajorProject.project_types
        : PROJECT_TYPE_OPTIONS,
    [selectedMajorProject],
  );

  useEffect(() => {
    if (!availableProjectTypes.includes(type)) {
      setType(availableProjectTypes[0] ?? 'general');
    }
  }, [availableProjectTypes, type]);

  const disabled = useMemo(
    () =>
      majorProjectId === '' ||
      !name.trim() ||
      participantIds.length === 0 ||
      (startDate !== '' && endDate !== '' && endDate < startDate) ||
      busy,
    [busy, endDate, majorProjectId, name, participantIds, startDate],
  );

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (disabled) return;
    setBusy(true);
    try {
      const created = await apiFetch<Project>('/projects', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          major_project_id: majorProjectId,
          project_type: type,
          participant_ids: participantIds,
          start_date: startDate || null,
          end_date: endDate || null,
          vehicle_sets: normalizeVehicleSets(vehicleSets),
        }),
      });
      let templateError = '';
      try {
        await ensureDefaultTemplate(created);
      } catch (nextError) {
        templateError = (nextError as Error).message;
      }
      setName('');
      setMajorProjectId(initialMajorProjectId);
      setType(availableProjectTypes[0] ?? 'general');
      setStartDate('');
      setEndDate('');
      setVehicleSets([]);
      setParticipantIds([]);
      onCreated(created);
      if (templateError) {
        onError(`프로젝트는 생성됐지만 기본 템플릿을 만들지 못했습니다: ${templateError}`);
      }
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="mb-6 rounded-2xl border border-border bg-white p-4 shadow-sm"
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="프로젝트 이름" span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="예: 2026 Q2 정기 검증"
              className={controlClass}
            />
          </Field>

          <Field label="대프로젝트" span>
            <select
              value={majorProjectId}
              onChange={(event) => {
                const nextId = event.target.value === '' ? '' : Number(event.target.value);
                setMajorProjectId(nextId);
                setParticipantIds([]);
              }}
              className={controlClass}
            >
              <option value="">대프로젝트를 선택하세요</option>
              {majorProjects.map((majorProject) => (
                <option key={majorProject.id} value={majorProject.id}>
                  {majorProject.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="유형" span>
            <select
              value={type}
              onChange={(event) => setType(event.target.value as ProjectType)}
              className={controlClass}
            >
              {availableProjectTypes.map((option) => (
                <option key={option} value={option}>
                  {PROJECT_TYPE_LABEL[option] ?? option}
                </option>
              ))}
            </select>
          </Field>

          <Field label="시작일">
            <DateInput value={startDate} onChange={setStartDate} />
          </Field>

          <Field label="종료일">
            <DateInput value={endDate} onChange={setEndDate} />
          </Field>

          <div className="sm:col-span-2">
            <VehicleSetEditor
              value={vehicleSets}
              onChange={setVehicleSets}
              disabled={busy}
            />
          </div>

          <div className="flex items-end justify-end sm:col-span-2">
            <button
              type="submit"
              disabled={disabled}
              className="h-10 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? '생성 중...' : '+ 프로젝트 생성'}
            </button>
          </div>
        </div>

        <div className="flex h-[292px] min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-surface-muted p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-medium text-text">프로젝트 참여 인원</p>
            <span className="text-xs text-text-subtle">
              {participantIds.length}/{selectableUsers.length}명
            </span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            <OrganizationMemberPicker
              users={selectableUsers}
              selectedIds={participantIds}
              onChange={setParticipantIds}
              disabled={busy}
            />
          </div>
        </div>
      </div>
    </form>
  );
}

async function ensureDefaultTemplate(project: Project) {
  const schema = defaultFieldSchema(String(project.project_type));
  const projectTemplateType = `project_${project.id}_template_default`;

  await apiFetch(`/field-schemas/${projectTemplateType}`, {
    method: 'PUT',
    body: JSON.stringify({
      project_type: projectTemplateType,
      section_label: schema.section_label,
      fields: schema.fields,
      weight: schema.weight,
    }),
  });
}

function Field({
  label,
  children,
  span = false,
}: {
  label: string;
  children: ReactNode;
  span?: boolean;
}) {
  return (
    <label className={span ? 'block sm:col-span-2' : 'block'}>
      <span className="mb-1 block text-xs font-medium text-text-muted">
        {label}
      </span>
      {children}
    </label>
  );
}

function DateInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <input
      type="date"
      value={value}
      max={MAX_DATE_VALUE}
      onInput={(event) => {
        event.currentTarget.value = clampDateYear(event.currentTarget.value);
      }}
      onChange={(event) => onChange(clampDateYear(event.target.value))}
      className={controlClass}
    />
  );
}
