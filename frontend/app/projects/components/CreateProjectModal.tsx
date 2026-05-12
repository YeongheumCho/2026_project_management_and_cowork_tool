'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Modal from '../../components/Modal';
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
  open: boolean;
  users: UserBrief[];
  defaultDate?: string;
  onClose: () => void;
  onCreated: (project: Project) => Promise<void> | void;
  onError: (message: string) => void;
};

const PROJECT_TYPE_OPTIONS: ProjectType[] = [
  'official_inspection',
  'regular_inspection',
  'change_inspection',
  'etc_task',
  'general',
];

export default function CreateProjectModal({
  open,
  users,
  defaultDate,
  onClose,
  onCreated,
  onError,
}: Props) {
  const [name, setName] = useState('');
  const [type, setType] = useState<ProjectType>('official_inspection');
  const [startDate, setStartDate] = useState(defaultDate ?? '');
  const [endDate, setEndDate] = useState(defaultDate ?? '');
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

  useEffect(() => {
    if (!open) return;
    setStartDate(defaultDate ?? '');
    setEndDate(defaultDate ?? '');
  }, [defaultDate, open]);

  function reset() {
    setName('');
    setType('official_inspection');
    setStartDate(defaultDate ?? '');
    setEndDate(defaultDate ?? '');
    setParticipantIds([]);
  }

  function handleClose() {
    if (busy) return;
    reset();
    onClose();
  }

  async function submit(event: FormEvent) {
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
      await onCreated(created);
      reset();
      onClose();
    } catch (error) {
      onError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={handleClose} size="lg" ariaLabel="새 프로젝트 생성">
      {/* Modal(flex-col max-h-[90vh])을 부모로 삼아 조직도 영역만 스크롤되도록 한다. */}
      <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col gap-5">
        <div className="flex-shrink-0">
          <h2 className="text-xl font-semibold text-slate-900">새 프로젝트</h2>
          <p className="mt-1 text-sm text-slate-500">
            프로젝트 유형과 참여 인원을 먼저 정해 두면 하위 프로젝트 담당자를 더 정확하게 배정할 수 있습니다.
          </p>
        </div>

        <div className="flex-shrink-0">
          <label
            htmlFor="project-name"
            className="block text-sm font-medium text-slate-700"
          >
            프로젝트 이름
          </label>
          <input
            id="project-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="예: 2026년 3차 정기 검증"
            className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
          />
        </div>

        <div className="flex-shrink-0">
          <label
            htmlFor="project-type"
            className="block text-sm font-medium text-slate-700"
          >
            프로젝트 유형
          </label>
          <select
            id="project-type"
            value={type}
            onChange={(event) => setType(event.target.value as ProjectType)}
            className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
          >
            {PROJECT_TYPE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {PROJECT_TYPE_LABEL[option]}
              </option>
            ))}
          </select>
        </div>

        <div className="grid flex-shrink-0 gap-4 md:grid-cols-2">
          <div>
            <label
              htmlFor="project-start-date"
              className="block text-sm font-medium text-slate-700"
            >
              시작일
            </label>
            <input
              id="project-start-date"
              type="date"
              value={startDate}
              max={MAX_DATE_VALUE}
              onInput={(event) => {
                event.currentTarget.value = clampDateYear(event.currentTarget.value);
              }}
              onChange={(event) => setStartDate(clampDateYear(event.target.value))}
              className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
          </div>
          <div>
            <label
              htmlFor="project-end-date"
              className="block text-sm font-medium text-slate-700"
            >
              종료일
            </label>
            <input
              id="project-end-date"
              type="date"
              value={endDate}
              max={MAX_DATE_VALUE}
              onInput={(event) => {
                event.currentTarget.value = clampDateYear(event.currentTarget.value);
              }}
              onChange={(event) => setEndDate(clampDateYear(event.target.value))}
              className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex flex-shrink-0 items-center justify-between">
            <label className="block text-sm font-medium text-slate-700">
              프로젝트 참여 인원
            </label>
            <span className="text-xs text-slate-500">
              {participantIds.length}명 선택됨
            </span>
          </div>
          <p className="mt-1 flex-shrink-0 text-xs text-slate-500">
            이후 하위 프로젝트 담당자는 여기서 선택한 인원 안에서만 지정됩니다.
          </p>
          <div className="mt-3 min-h-0 flex-1 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <OrganizationMemberPicker
              users={users}
              selectedIds={participantIds}
              onChange={setParticipantIds}
              emptyLabel="선택 가능한 인원이 없습니다."
              disabled={busy}
            />
          </div>
        </div>

        <div className="flex flex-shrink-0 justify-end gap-2 border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={disabled}
            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? '생성 중...' : '프로젝트 생성'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
