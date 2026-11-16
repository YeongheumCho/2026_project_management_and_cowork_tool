'use client';

import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import ConfirmDialog from '../components/ConfirmDialog';
import Modal from '../components/Modal';
import { apiFetch, type EquipmentBoard, type MajorProject } from '../lib/api';

type Props = {
  open: boolean;
  boards: EquipmentBoard[];
  onClose: () => void;
  /** 그룹이 바뀌면 목록을 다시 읽는다. 새로 만든 그룹의 id 를 주면 그 그룹으로 옮긴다. */
  onChanged: (focusBoardId?: number) => Promise<void>;
};

type Form = {
  /** null 이면 새 그룹 */
  id: number | null;
  name: string;
  majorProjectIds: number[];
  copyColumnsFrom: number | '';
};

const EMPTY_FORM: Form = { id: null, name: '', majorProjectIds: [], copyColumnsFrom: '' };

/**
 * B-112: 장비 그룹 관리 (관리자).
 * 같은 장비를 쓰는 대프로젝트를 골라 한 그룹으로 묶는다. 그 대프로젝트에 속한 사람만 그 그룹을 본다.
 * 대프로젝트를 하나도 고르지 않으면 모든 사람이 본다.
 */
export default function BoardManager({ open, boards, onClose, onChanged }: Props) {
  const [majorProjects, setMajorProjects] = useState<MajorProject[]>([]);
  const [form, setForm] = useState<Form>(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<EquipmentBoard | null>(null);

  useEffect(() => {
    if (!open) return;
    setForm(EMPTY_FORM);
    setError('');
    apiFetch<MajorProject[]>('/major-projects')
      .then(setMajorProjects)
      .catch((err: Error) => setError(err.message));
  }, [open]);

  function startEdit(board: EquipmentBoard) {
    setError('');
    setForm({
      id: board.id,
      name: board.name,
      majorProjectIds: board.major_projects.map((major) => major.id),
      copyColumnsFrom: '',
    });
  }

  function toggleMajor(id: number) {
    setForm((current) => ({
      ...current,
      majorProjectIds: current.majorProjectIds.includes(id)
        ? current.majorProjectIds.filter((item) => item !== id)
        : [...current.majorProjectIds, id],
    }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const name = form.name.trim();
    if (!name || busy) return;
    setBusy(true);
    setError('');
    try {
      if (form.id === null) {
        const created = await apiFetch<EquipmentBoard>('/equipment/boards', {
          method: 'POST',
          body: JSON.stringify({
            name,
            major_project_ids: form.majorProjectIds,
            copy_columns_from: form.copyColumnsFrom === '' ? null : form.copyColumnsFrom,
          }),
        });
        await onChanged(created.id);
      } else {
        await apiFetch<EquipmentBoard>(`/equipment/boards/${form.id}`, {
          method: 'PUT',
          body: JSON.stringify({ name, major_project_ids: form.majorProjectIds }),
        });
        await onChanged();
      }
      setForm(EMPTY_FORM);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    const target = deleteTarget;
    if (!target) return;
    setBusy(true);
    setError('');
    try {
      await apiFetch<void>(`/equipment/boards/${target.id}`, { method: 'DELETE' });
      if (form.id === target.id) setForm(EMPTY_FORM);
      await onChanged();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDeleteTarget(null);
      setBusy(false);
    }
  }

  const editing = form.id !== null;

  return (
    <>
      <Modal open={open} onClose={onClose} size="xl" scrollable ariaLabel="장비 그룹 관리">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-heading font-bold text-text">장비 그룹 관리</h2>
            <p className="mt-1 text-small text-text-subtle">
              같은 장비를 쓰는 대프로젝트를 골라 한 그룹으로 묶습니다. 고른 대프로젝트(또는 그 아래 프로젝트)에
              참여한 사람만 그 그룹을 봅니다. 하나도 고르지 않으면 모든 사람이 봅니다. 그룹마다 열과 줄이 따로입니다.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-full border border-border px-3 py-1.5 text-small text-text-muted hover:bg-surface-muted"
          >
            닫기
          </button>
        </div>

        {error && (
          <p className="mt-4 rounded-lg bg-verify-fail-bg px-3 py-2 text-small text-verify-fail-fg">{error}</p>
        )}

        <ul className="mt-4 space-y-2">
          {boards.map((board) => (
            <li
              key={board.id}
              className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-3 py-2.5 ${
                form.id === board.id ? 'border-brand bg-brand-soft' : 'border-border bg-surface-muted'
              }`}
            >
              <div className="min-w-0">
                <p className="text-small font-bold text-text">
                  {board.name}
                  {board.is_default && (
                    <span className="ml-2 rounded-full bg-brand-soft px-2 py-0.5 text-tiny text-brand">기본</span>
                  )}
                  <span className="ml-2 text-tiny font-normal text-text-subtle">장비 {board.row_count}줄</span>
                </p>
                <p className="mt-0.5 text-tiny text-text-subtle">
                  {board.major_projects.length > 0
                    ? `연결: ${board.major_projects.map((major) => major.name).join(', ')}`
                    : '연결된 대프로젝트 없음 · 모든 사람이 봅니다'}
                </p>
              </div>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => startEdit(board)}
                  className="rounded-full border border-border bg-white px-3 py-1 text-tiny font-semibold text-brand"
                >
                  수정
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(board)}
                  disabled={board.is_default || board.row_count > 0 || busy}
                  title={
                    board.is_default
                      ? '기본 장비 현황은 지울 수 없습니다.'
                      : board.row_count > 0
                        ? '장비 줄을 모두 지운 뒤 삭제할 수 있습니다.'
                        : undefined
                  }
                  className="rounded-full border border-border bg-white px-3 py-1 text-tiny font-semibold text-verify-fail-fg disabled:cursor-not-allowed disabled:opacity-40"
                >
                  삭제
                </button>
              </div>
            </li>
          ))}
        </ul>

        <form onSubmit={submit} className="mt-5 rounded-2xl border border-border p-4">
          <h3 className="text-small font-bold text-text">
            {editing ? '그룹 수정' : '새 그룹 만들기'}
          </h3>
          <label className="mt-3 block">
            <span className="text-tiny font-semibold text-text-subtle">그룹 이름</span>
            <input
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              maxLength={100}
              placeholder="예: ES실 dSPACE 장비, ES실 제어기"
              className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-small"
            />
          </label>

          <div className="mt-3">
            <p className="text-tiny font-semibold text-text-subtle">
              이 장비를 쓰는 대프로젝트 ({form.majorProjectIds.length}개 선택)
            </p>
            <div className="mt-1 max-h-44 space-y-1 overflow-y-auto rounded-lg border border-border bg-surface-muted p-2">
              {majorProjects.length === 0 && (
                <p className="px-1 py-2 text-tiny text-text-subtle">대프로젝트가 없습니다.</p>
              )}
              {majorProjects.map((major) => (
                <label key={major.id} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-small text-text hover:bg-white">
                  <input
                    type="checkbox"
                    checked={form.majorProjectIds.includes(major.id)}
                    onChange={() => toggleMajor(major.id)}
                  />
                  <span className="min-w-0 truncate">{major.name}</span>
                  <span className="ml-auto shrink-0 text-tiny text-text-subtle">참여 {major.members.length}명</span>
                </label>
              ))}
            </div>
          </div>

          {!editing && (
            <label className="mt-3 block">
              <span className="text-tiny font-semibold text-text-subtle">열 구성</span>
              <select
                value={form.copyColumnsFrom}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    copyColumnsFrom: event.target.value === '' ? '' : Number(event.target.value),
                  }))
                }
                className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-small"
              >
                <option value="">기본 열로 시작</option>
                {boards.map((board) => (
                  <option key={board.id} value={board.id}>
                    &quot;{board.name}&quot; 의 열을 그대로 가져오기
                  </option>
                ))}
              </select>
            </label>
          )}

          <div className="mt-4 flex gap-2">
            <button
              type="submit"
              disabled={busy || !form.name.trim()}
              className="rounded-full bg-brand px-4 py-2 text-small font-bold text-white disabled:opacity-50"
            >
              {busy ? '저장 중...' : editing ? '그룹 저장' : '그룹 만들기'}
            </button>
            {editing && (
              <button
                type="button"
                onClick={() => setForm(EMPTY_FORM)}
                className="rounded-full border border-border px-4 py-2 text-small font-semibold text-text-muted"
              >
                취소
              </button>
            )}
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="장비 그룹 삭제"
        description={
          deleteTarget
            ? `"${deleteTarget.name}" 그룹과 그 열 구성을 삭제합니다. 변경 이력은 남지만 화면에서는 볼 수 없게 됩니다.`
            : ''
        }
        confirmLabel="삭제"
        variant="danger"
        busy={busy}
        onConfirm={() => void confirmDelete()}
        onClose={() => setDeleteTarget(null)}
      />
    </>
  );
}
