'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Modal from '../../components/Modal';
import OrganizationMemberPicker from '../../components/OrganizationMemberPicker';
import {
  apiFetch,
  PROJECT_TYPE_LABEL,
  PROJECT_TYPE_OPTIONS,
  type MajorProject,
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
  const [majorProjects, setMajorProjects] = useState<MajorProject[]>([]);
  const [majorProjectId, setMajorProjectId] = useState<number | ''>('');
  const [busy, setBusy] = useState(false);
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
    if (!open || !availableProjectTypes.length) return;
    if (!availableProjectTypes.includes(type)) {
      setType(availableProjectTypes[0]);
    }
  }, [availableProjectTypes, open, type]);

  const disabled = useMemo(
    () =>
      !name.trim() ||
      majorProjectId === '' ||
      participantIds.length === 0 ||
      (startDate !== '' && endDate !== '' && endDate < startDate) ||
      busy,
    [busy, endDate, majorProjectId, name, participantIds, startDate],
  );

  useEffect(() => {
    if (!open) return;
    setStartDate(defaultDate ?? '');
    setEndDate(defaultDate ?? '');
    apiFetch<MajorProject[]>('/major-projects')
      .then((items) => {
        setMajorProjects(items);
        setMajorProjectId((current) => current || items[0]?.id || '');
      })
      .catch((error) => onError((error as Error).message));
  }, [defaultDate, open]);

  function reset() {
    setName('');
    setType(availableProjectTypes[0] ?? 'general');
    setMajorProjectId(majorProjects[0]?.id ?? '');
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
          major_project_id: majorProjectId,
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
    <Modal open={open} onClose={handleClose} size="lg" ariaLabel="프로젝트 생성">
      <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col gap-5">
        <div className="flex-shrink-0">
          <h2 className="text-xl font-semibold text-text">프로젝트 생성</h2>
          <p className="mt-1 text-sm text-text-subtle">
            프로젝트 유형과 참여 인원을 먼저 정하면 하위 프로젝트 담당자를 더 정확하게 배정할 수 있습니다.
          </p>
        </div>

        <div className="flex-shrink-0">
          <label
            htmlFor="project-name"
            className="block text-sm font-medium text-text"
          >
            프로젝트 이름
          </label>
          <input
            id="project-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="예: 2026년 3차 정기 검증"
            className="mt-2 w-full rounded-xl border border-border px-3 py-2.5 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
          />
        </div>

        <div className="flex-shrink-0">
          <label htmlFor="project-major" className="block text-sm font-medium text-text">
            대프로젝트
          </label>
          <select
            id="project-major"
            value={majorProjectId}
            onChange={(event) => {
              const nextId = event.target.value === '' ? '' : Number(event.target.value);
              setMajorProjectId(nextId);
              setParticipantIds([]);
            }}
            className="mt-2 w-full rounded-xl border border-border px-3 py-2.5 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
          >
            <option value="">대프로젝트를 선택하세요</option>
            {majorProjects.map((majorProject) => (
              <option key={majorProject.id} value={majorProject.id}>
                {majorProject.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-shrink-0">
          <label
            htmlFor="project-type"
            className="block text-sm font-medium text-text"
          >
            프로젝트 유형
          </label>
          <select
            id="project-type"
            value={type}
            onChange={(event) => setType(event.target.value as ProjectType)}
            className="mt-2 w-full rounded-xl border border-border px-3 py-2.5 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
          >
            {availableProjectTypes.map((option) => (
              <option key={option} value={option}>
                {PROJECT_TYPE_LABEL[option] ?? option}
              </option>
            ))}
          </select>
        </div>

        <div className="grid flex-shrink-0 gap-4 md:grid-cols-2">
          <div>
            <label
              htmlFor="project-start-date"
              className="block text-sm font-medium text-text"
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
              className="mt-2 w-full rounded-xl border border-border px-3 py-2.5 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
          </div>
          <div>
            <label
              htmlFor="project-end-date"
              className="block text-sm font-medium text-text"
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
              className="mt-2 w-full rounded-xl border border-border px-3 py-2.5 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex flex-shrink-0 items-center justify-between">
            <label className="block text-sm font-medium text-text">
              프로젝트 참여 인원
            </label>
            <span className="text-xs text-text-subtle">
              {participantIds.length}명 선택됨
            </span>
          </div>
          <p className="mt-1 flex-shrink-0 text-xs text-text-subtle">
            이후 하위 프로젝트 담당자는 여기에서 선택한 인원 안에서만 지정됩니다.
          </p>
          <div className="mt-3 min-h-0 flex-1 overflow-y-auto rounded-2xl border border-border bg-surface-muted p-3">
            <OrganizationMemberPicker
              users={selectableUsers}
              selectedIds={participantIds}
              onChange={setParticipantIds}
              emptyLabel="선택 가능한 인원이 없습니다."
              disabled={busy}
            />
          </div>
        </div>

        <div className="flex flex-shrink-0 justify-end gap-2 border-t border-border-subtle pt-4">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-text-muted hover:bg-surface-muted"
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
