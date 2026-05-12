'use client';

import { FormEvent, type ReactNode, useMemo, useState } from 'react';
import OrganizationMemberPicker from '../../components/OrganizationMemberPicker';
import {
  apiFetch,
  PROJECT_TYPE_LABEL,
  type Project,
  type ProjectType,
  type UserBrief,
} from '../../lib/api';
import { clampDateYear, MAX_DATE_VALUE } from '../../lib/dateInput';

type Props = {
  users: UserBrief[];
  onCreated: (project: Project) => void;
  onError: (msg: string) => void;
};

const PROJECT_TYPE_OPTIONS: ProjectType[] = [
  'official_inspection',
  'regular_inspection',
  'change_inspection',
  'etc_task',
  'general',
];

const controlClass =
  'mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm';

export default function CreateProjectForm({ users, onCreated, onError }: Props) {
  const [name, setName] = useState('');
  const [type, setType] = useState<ProjectType>('official_inspection');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [participantIds, setParticipantIds] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);

  const disabled = useMemo(
    () =>
      !name.trim() ||
      participantIds.length === 0 ||
      (startDate !== '' && endDate !== '' && endDate < startDate) ||
      busy,
    [busy, endDate, name, participantIds, startDate],
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
          project_type: type,
          participant_ids: participantIds,
          start_date: startDate || null,
          end_date: endDate || null,
        }),
      });
      setName('');
      setType('official_inspection');
      setStartDate('');
      setEndDate('');
      setParticipantIds([]);
      onCreated(created);
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div className="grid content-center gap-3 sm:grid-cols-2 lg:h-[292px]">
          <Field label="프로젝트 이름" span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="예: 2026 Q2 정기 점검"
              className={controlClass}
            />
          </Field>

          <Field label="유형" span>
            <select
              value={type}
              onChange={(event) => setType(event.target.value as ProjectType)}
              className={controlClass}
            >
              {PROJECT_TYPE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {PROJECT_TYPE_LABEL[option]}
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

        <div className="flex min-h-[292px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-3 lg:h-[292px]">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-medium text-slate-700">프로젝트 참여 인원</p>
            <span className="text-xs text-slate-500">
              {participantIds.length}/{users.length}명
            </span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            <OrganizationMemberPicker
              users={users}
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
      <span className="mb-1 block text-xs font-medium text-slate-600">
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
