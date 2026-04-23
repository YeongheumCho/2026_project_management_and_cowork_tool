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
  const [participantIds, setParticipantIds] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !project) return;
    setName(project.name);
    setType(project.project_type as ProjectType);
    setParticipantIds(project.participants.map((user) => user.id));
  }, [open, project]);

  const disabled = useMemo(
    () => !project || !name.trim() || participantIds.length === 0 || busy,
    [project, name, participantIds, busy],
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
      <form onSubmit={submit} className="space-y-5">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">프로젝트 수정</h2>
          <p className="mt-1 text-sm text-slate-500">
            프로젝트 이름, 유형, 참여 인원을 수정할 수 있습니다.
          </p>
        </div>

        <div>
          <label
            htmlFor="project-edit-name"
            className="block text-sm font-medium text-slate-700"
          >
            프로젝트 이름
          </label>
          <input
            id="project-edit-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
          />
        </div>

        <div>
          <label
            htmlFor="project-edit-type"
            className="block text-sm font-medium text-slate-700"
          >
            프로젝트 유형
          </label>
          <select
            id="project-edit-type"
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

        <div>
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium text-slate-700">
              프로젝트 참여 인원
            </label>
            <span className="text-xs text-slate-500">{participantIds.length}명 선택됨</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            이미 배정된 하위 프로젝트 담당자는 참여 인원에서 제외할 수 없습니다.
          </p>
          <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <OrganizationMemberPicker
              users={users}
              selectedIds={participantIds}
              onChange={setParticipantIds}
              disabled={busy}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
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
