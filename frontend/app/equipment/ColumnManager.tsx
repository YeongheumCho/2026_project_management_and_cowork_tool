'use client';

import type { FormEvent, KeyboardEvent } from 'react';
import { useEffect, useState } from 'react';
import ConfirmDialog from '../components/ConfirmDialog';
import Modal from '../components/Modal';
import { apiFetch, type EquipmentColumn } from '../lib/api';

type Props = {
  open: boolean;
  columns: EquipmentColumn[];
  onClose: () => void;
  /** 열이 바뀌면 표를 다시 읽는다. 열을 지웠으면 줄 값도 바뀌므로 함께 읽는다. */
  onChanged: () => Promise<void>;
};

/**
 * 장비 현황표의 열(항목) 관리. 누구나 이름 변경·추가·삭제·순서 변경을 할 수 있다.
 * 바꾼 내용은 바로 서버에 저장되고 모든 팀원의 표에 반영된다.
 */
export default function ColumnManager({ open, columns, onClose, onChanged }: Props) {
  const [labels, setLabels] = useState<Record<number, string>>({});
  const [newLabel, setNewLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<EquipmentColumn | null>(null);

  useEffect(() => {
    if (!open) return;
    setLabels(Object.fromEntries(columns.map((column) => [column.id, column.label])));
  }, [open, columns]);

  useEffect(() => {
    if (open) setError('');
  }, [open]);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError('');
    try {
      await action();
      await onChanged();
    } catch (err) {
      setError((err as Error).message);
      // 실패한 이름 변경은 원래 이름으로 되돌린다.
      setLabels(Object.fromEntries(columns.map((column) => [column.id, column.label])));
    } finally {
      setBusy(false);
    }
  }

  function rename(column: EquipmentColumn) {
    const label = (labels[column.id] ?? '').trim();
    if (!label) {
      setLabels((current) => ({ ...current, [column.id]: column.label }));
      return;
    }
    if (label === column.label) return;
    void run(() =>
      apiFetch(`/equipment/columns/${column.id}`, {
        method: 'PUT',
        body: JSON.stringify({ label }),
      }),
    );
  }

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= columns.length) return;
    const ids = columns.map((column) => column.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    void run(() =>
      apiFetch('/equipment/columns/order', {
        method: 'PUT',
        body: JSON.stringify({ column_ids: ids }),
      }),
    );
  }

  function add(event: FormEvent) {
    event.preventDefault();
    const label = newLabel.trim();
    if (!label) return;
    void run(async () => {
      await apiFetch('/equipment/columns', { method: 'POST', body: JSON.stringify({ label }) });
      setNewLabel('');
    });
  }

  function onLabelKeyDown(event: KeyboardEvent<HTMLInputElement>, column: EquipmentColumn) {
    if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
      event.preventDefault();
      event.currentTarget.blur();
    }
    if (event.key === 'Escape') {
      setLabels((current) => ({ ...current, [column.id]: column.label }));
    }
  }

  return (
    <>
      <Modal open={open} onClose={onClose} size="md" scrollable ariaLabel="장비 현황 열 관리">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-heading font-bold text-text">열(항목) 관리</h2>
            <p className="mt-1 text-small text-text-subtle">
              이름을 고치고 Enter 를 누르거나 다른 곳을 누르면 저장됩니다. 바꾼 내용은 모든 팀원의 표에 바로 반영되고 변경 이력에 남습니다.
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
          <p className="mt-3 rounded-lg bg-verify-fail-bg px-3 py-2 text-small text-verify-fail-fg">{error}</p>
        )}

        <ul className="mt-4 space-y-1.5">
          {columns.map((column, index) => (
            <li key={column.id} className="flex items-center gap-1.5">
              <span className="w-6 shrink-0 text-right text-tiny text-text-subtle">{index + 1}</span>
              <input
                value={labels[column.id] ?? column.label}
                onChange={(event) =>
                  setLabels((current) => ({ ...current, [column.id]: event.target.value }))
                }
                onBlur={() => rename(column)}
                onKeyDown={(event) => onLabelKeyDown(event, column)}
                disabled={busy}
                aria-label={`${column.label} 열 이름`}
                maxLength={100}
                className="min-w-0 flex-1 rounded-lg border border-border px-2.5 py-1.5 text-small text-text"
              />
              <button
                type="button"
                onClick={() => move(index, -1)}
                disabled={busy || index === 0}
                aria-label={`${column.label} 열을 앞으로`}
                className="shrink-0 rounded-lg border border-border px-2 py-1.5 text-tiny text-text-muted disabled:opacity-30"
              >
                ▲
              </button>
              <button
                type="button"
                onClick={() => move(index, 1)}
                disabled={busy || index === columns.length - 1}
                aria-label={`${column.label} 열을 뒤로`}
                className="shrink-0 rounded-lg border border-border px-2 py-1.5 text-tiny text-text-muted disabled:opacity-30"
              >
                ▼
              </button>
              <button
                type="button"
                onClick={() => setDeleteTarget(column)}
                disabled={busy || columns.length <= 1}
                className="shrink-0 whitespace-nowrap rounded-lg border border-border px-2 py-1.5 text-tiny text-verify-fail-fg hover:bg-verify-fail-bg disabled:opacity-30"
              >
                삭제
              </button>
            </li>
          ))}
        </ul>

        <form onSubmit={add} className="mt-4 flex items-center gap-2 border-t border-border pt-4">
          <input
            value={newLabel}
            onChange={(event) => setNewLabel(event.target.value)}
            placeholder="새 열 이름 (예: 위치)"
            maxLength={100}
            disabled={busy}
            className="min-w-0 flex-1 rounded-lg border border-border px-2.5 py-1.5 text-small"
          />
          <button
            type="submit"
            disabled={busy || !newLabel.trim()}
            className="shrink-0 whitespace-nowrap rounded-full bg-brand px-4 py-1.5 text-small font-bold text-white disabled:opacity-50"
          >
            + 열 추가
          </button>
        </form>
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="열 삭제"
        description={
          deleteTarget
            ? `'${deleteTarget.label}' 열과 그 열에 입력된 값이 모든 팀원의 표에서 사라집니다. 지운 값은 변경 이력에서 장비별로 확인할 수 있습니다.`
            : ''
        }
        confirmLabel="삭제"
        variant="danger"
        busy={busy}
        onConfirm={() => {
          const target = deleteTarget;
          setDeleteTarget(null);
          if (target) void run(() => apiFetch(`/equipment/columns/${target.id}`, { method: 'DELETE' }));
        }}
        onClose={() => setDeleteTarget(null)}
      />
    </>
  );
}
