'use client';

import { FormEvent, useState } from 'react';
import { apiFetch, type Project, type ProjectType } from '../../lib/api';

type Props = {
  /** 생성 후 호출 — 목록 재로드와 새 프로젝트 자동 펼침에 사용 */
  onCreated: (project: Project) => void;
  onError: (msg: string) => void;
};

/**
 * 관리자용 프로젝트 생성 폼 (상단 바 형태).
 * 일반 사용자에게는 이 컴포넌트를 렌더하지 않는다 — 부모에서 가드.
 */
export default function CreateProjectForm({ onCreated, onError }: Props) {
  const [name, setName] = useState('');
  const [type, setType] = useState<ProjectType>('official_inspection');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      const created = await apiFetch<Project>('/projects', {
        method: 'POST',
        body: JSON.stringify({ name, project_type: type }),
      });
      setName('');
      setType('official_inspection');
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
      className="mb-6 flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <div className="flex-1 min-w-[200px]">
        <label className="block text-xs font-medium text-slate-600">
          프로젝트 이름
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="예: 2026 Q2 정기 검증"
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600">유형</label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as ProjectType)}
          className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
        >
          <option value="official_inspection">공식 검증</option>
          <option value="regular_inspection">정기 검증</option>
          <option value="change_inspection">변경점 검증</option>
          <option value="etc_task">기타 업무</option>
          <option value="general">일반</option>
        </select>
      </div>
      <button
        type="submit"
        disabled={!name.trim() || busy}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        + 프로젝트 생성
      </button>
    </form>
  );
}
