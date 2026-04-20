'use client';

import { useState } from 'react';
import { apiFetch, type SubProject, type SubTask } from '../lib/api';

type Props = {
  open: boolean;
  isAdmin: boolean;
  currentUserId: number;
  subproject: SubProject | null;
  onClose: () => void;
  onChanged: () => void; // 체크 상태 변화 후 재로드
};

/**
 * 담당자/관리자가 세부 태스크를 체크/해제하는 Modal.
 * 현재 진행 단계(첫 미완료 태스크)에 ▶ 아이콘을 표시하고,
 * 완료된 단계는 취소선 + 회색으로 표시한다.
 */
export default function PersonalModal({
  open,
  isAdmin,
  currentUserId,
  subproject,
  onClose,
  onChanged,
}: Props) {
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState('');

  if (!open || !subproject) return null;

  const canEdit =
    isAdmin ||
    (subproject.assignee_id !== null && subproject.assignee_id === currentUserId);

  // 정렬된 세부 태스크
  const tasks = [...subproject.subtasks].sort(
    (a, b) => a.order_index - b.order_index,
  );

  // 현재 진행 단계: 첫 번째 미완료 태스크
  const currentStep = tasks.find((t) => !t.is_done);

  const toggle = async (task: SubTask) => {
    if (!canEdit || busy !== null) return;
    setBusy(task.id);
    setError('');
    try {
      await apiFetch(`/subtasks/${task.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_done: !task.is_done }),
      });
      onChanged();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const isAllDone = tasks.length > 0 && tasks.every((t) => t.is_done);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold">{subproject.name}</h3>
            <p className="mt-1 text-xs text-slate-500">
              담당자: {subproject.assignee?.name ?? '미지정'} ·{' '}
              {subproject.start_date} ~ {subproject.end_date}
            </p>
          </div>
          {isAllDone && (
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
              완료 — 전체 반영됨
            </span>
          )}
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>진척도</span>
            <span>{subproject.progress.toFixed(0)}%</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full bg-blue-500 transition-all"
              style={{ width: `${subproject.progress}%` }}
            />
          </div>
        </div>

        {!canEdit && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
            본인이 담당한 태스크만 체크할 수 있습니다.
          </p>
        )}

        <ul className="mt-4 space-y-2">
          {tasks.map((t) => {
            const isCurrent = currentStep?.id === t.id;
            return (
              <li
                key={t.id}
                className={`flex items-center gap-3 rounded-xl border px-3 py-2 text-sm ${
                  t.is_done
                    ? 'border-slate-100 bg-slate-50'
                    : isCurrent
                      ? 'border-blue-200 bg-blue-50'
                      : 'border-slate-200 bg-white'
                }`}
              >
                <input
                  type="checkbox"
                  checked={t.is_done}
                  disabled={!canEdit || busy !== null}
                  onChange={() => toggle(t)}
                  className="h-4 w-4"
                />
                <span
                  className={
                    t.is_done ? 'text-slate-400 line-through' : 'text-slate-800'
                  }
                >
                  {isCurrent && !t.is_done && '▶ '}
                  {t.name}
                </span>
                <span className="ml-auto text-xs text-slate-400">
                  가중치 {Number(t.weight).toFixed(0)}
                </span>
              </li>
            );
          })}
        </ul>

        {error && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="mt-5 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm hover:bg-slate-50"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
