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
  project: Project | null;
  users: UserBrief[];
  onClose: () => void;
  onSaved: () => Promise<void> | void;
  onError: (message: string) => void;
};

const PROJECT_TYPE_OPTIONS: ProjectType[] = [
  'official_inspection',
  'regular_inspection',
  'change_inspection',
  'etc_task',
  'general',
];

export default function ProjectManageModal({
  open,
  project,
  users,
  onClose,
  onSaved,
  onError,
}: Props) {
  const [name, setName] = useState('');
  const [type, setType] = useState<ProjectType>('official_inspection');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [participantIds, setParticipantIds] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !project) return;
    setName(project.name);
    setType(project.project_type as ProjectType);
    setStartDate(project.start_date ?? '');
    setEndDate(project.end_date ?? '');
    setParticipantIds(project.participants.map((user) => user.id));
  }, [open, project]);

  const disabled = useMemo(
    () =>
      !project ||
      !name.trim() ||
      participantIds.length === 0 ||
      (startDate !== '' && endDate !== '' && endDate < startDate) ||
      busy,
    [project, name, participantIds, startDate, endDate, busy],
  );

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (disabled || !project) return;

    setBusy(true);
    try {
      await apiFetch<Project>(`/projects/${project.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: name.trim(),
          project_type: type,
          start_date: startDate || null,
          end_date: endDate || null,
          participant_ids: participantIds,
        }),
      });
      await onSaved();
      onClose();
    } catch (error) {
      onError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} size="lg" ariaLabel="프로젝트 수정">
      {/* Modal(flex-col max-h-[90vh])을 부모로 삼아 조직도 영역만 스크롤되도록 한다. */}
      <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col gap-5">
        <div className="flex-shrink-0">
          <h2 className="text-xl font-semibold text-text">프로젝트 수정</h2>
          <p className="mt-1 text-sm text-text-subtle">
            프로젝트 이름, 유형, 참여 인원을 수정할 수 있습니다.
          </p>
        </div>

        <div className="flex-shrink-0">
          <label
            htmlFor="project-edit-name"
            className="block text-sm font-medium text-text"
          >
            프로젝트 이름
          </label>
          <input
            id="project-edit-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="mt-2 w-full rounded-xl border border-border px-3 py-2.5 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
          />
        </div>

        <div className="flex-shrink-0">
          <label
            htmlFor="project-edit-type"
            className="block text-sm font-medium text-text"
          >
            프로젝트 유형
          </label>
          <select
            id="project-edit-type"
            value={type}
            onChange={(event) => setType(event.target.value as ProjectType)}
            className="mt-2 w-full rounded-xl border border-border px-3 py-2.5 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
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
              htmlFor="project-edit-start-date"
              className="block text-sm font-medium text-text"
            >
              시작일
            </label>
            <input
              id="project-edit-start-date"
              type="date"
              value={startDate}
              max={MAX_DATE_VALUE}
              onInput={(event) => {
                event.currentTarget.value = clampDateYear(event.currentTarget.value);
              }}
              onChange={(event) => setStartDate(clampDateYear(event.target.value))}
              className="mt-2 w-full rounded-xl border border-border px-3 py-2.5 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
          </div>
          <div>
            <label
              htmlFor="project-edit-end-date"
              className="block text-sm font-medium text-text"
            >
              종료일
            </label>
            <input
              id="project-edit-end-date"
              type="date"
              value={endDate}
              max={MAX_DATE_VALUE}
              onInput={(event) => {
                event.currentTarget.value = clampDateYear(event.currentTarget.value);
              }}
              onChange={(event) => setEndDate(clampDateYear(event.target.value))}
              className="mt-2 w-full rounded-xl border border-border px-3 py-2.5 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex flex-shrink-0 items-center justify-between">
            <label className="block text-sm font-medium text-text">
              프로젝트 참여 인원
            </label>
            <span className="text-xs text-text-subtle">{participantIds.length}명 선택됨</span>
          </div>
          <p className="mt-1 flex-shrink-0 text-xs text-text-subtle">
            이미 배정된 하위 프로젝트 담당자는 참여 인원에서 제외할 수 없습니다.
          </p>
          <div className="mt-3 max-h-[320px] min-h-0 flex-1 overflow-y-auto rounded-2xl border border-border bg-surface-muted p-3">
            <OrganizationMemberPicker
              users={users}
              selectedIds={participantIds}
              onChange={setParticipantIds}
              disabled={busy}
            />
          </div>
        </div>

        <div className="flex flex-shrink-0 justify-end gap-2 border-t border-border-subtle pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-text-muted hover:bg-surface-muted"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={disabled}
            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? '저장 중...' : '프로젝트 저장'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
