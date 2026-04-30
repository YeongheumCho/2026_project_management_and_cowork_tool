'use client';

import { FormEvent, useMemo, useState } from 'react';
import OrganizationMemberPicker from '../../components/OrganizationMemberPicker';
import {
  apiFetch,
  PROJECT_TYPE_LABEL,
  type Project,
  type ProjectType,
  type UserBrief,
} from '../../lib/api';

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
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-600">
              프로젝트 이름
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 2026 Q2 정기 점검"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600">유형</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as ProjectType)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              {PROJECT_TYPE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {PROJECT_TYPE_LABEL[option]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600">시작일</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600">종료일</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>

          <div className="flex items-end justify-end">
            <button
              type="submit"
              disabled={disabled}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {busy ? '생성 중...' : '+ 프로젝트 생성'}
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-medium text-slate-700">프로젝트 참여 인원</p>
            <span className="text-xs text-slate-500">{participantIds.length}명 선택됨</span>
          </div>
          <OrganizationMemberPicker
            users={users}
            selectedIds={participantIds}
            onChange={setParticipantIds}
            disabled={busy}
          />
        </div>
      </div>
    </form>
  );
}
