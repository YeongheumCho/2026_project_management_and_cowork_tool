'use client';

import { FormEvent, useMemo, useState } from 'react';
import Modal from '../../components/Modal';
import {
  apiFetch,
  PROJECT_TYPE_LABEL,
  type Project,
  type ProjectType,
} from '../../lib/api';

type Props = {
  open: boolean;
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
  onClose,
  onCreated,
  onError,
}: Props) {
  const [name, setName] = useState('');
  const [type, setType] = useState<ProjectType>('official_inspection');
  const [busy, setBusy] = useState(false);

  const disabled = useMemo(() => !name.trim() || busy, [name, busy]);

  function reset() {
    setName('');
    setType('official_inspection');
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
        body: JSON.stringify({ name: name.trim(), project_type: type }),
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
    <Modal open={open} onClose={handleClose} size="md" ariaLabel="새 프로젝트 생성">
      <form onSubmit={submit} className="space-y-5">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">새 프로젝트</h2>
          <p className="mt-1 text-sm text-slate-500">
            대시보드에서 바로 프로젝트를 만들고, 이후 세부 업무를 이어서 관리할
            수 있습니다.
          </p>
        </div>

        <div>
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

        <div>
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

        <div className="flex justify-end gap-2">
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
