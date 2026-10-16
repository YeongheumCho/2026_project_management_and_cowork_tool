'use client';

import { useEffect, useState } from 'react';
import Modal from '../components/Modal';
import { apiFetch, type EquipmentHistory } from '../lib/api';

const ACTION_LABEL: Record<EquipmentHistory['action'], string> = {
  create: '추가',
  update: '수정',
  delete: '삭제',
  column_create: '열 추가',
  column_rename: '열 이름 변경',
  column_delete: '열 삭제',
  column_move: '열 순서 변경',
};

const ADD_CLASS = 'bg-verify-pass-bg text-verify-pass-fg';
const EDIT_CLASS = 'bg-brand-soft text-brand';
const DELETE_CLASS = 'bg-verify-fail-bg text-verify-fail-fg';

const ACTION_CLASS: Record<EquipmentHistory['action'], string> = {
  create: ADD_CLASS,
  update: EDIT_CLASS,
  delete: DELETE_CLASS,
  column_create: ADD_CLASS,
  column_rename: EDIT_CLASS,
  column_delete: DELETE_CLASS,
  column_move: EDIT_CLASS,
};

/** 값이 바뀐 이력은 "이전 → 새 값", 추가는 새 값, 삭제는 지운 값을 보여 준다. */
function isChange(action: EquipmentHistory['action']) {
  return action === 'update' || action === 'column_rename' || action === 'column_move';
}

function isRemoval(action: EquipmentHistory['action']) {
  return action === 'delete' || action === 'column_delete';
}

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function HistoryModal({ open, onClose }: Props) {
  const [rows, setRows] = useState<EquipmentHistory[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setRows(null);
    apiFetch<EquipmentHistory[]>('/equipment/history?limit=200')
      .then((next) => {
        setRows(next);
        setError('');
      })
      .catch((err: Error) => setError(err.message));
  }, [open]);

  return (
    <Modal open={open} onClose={onClose} size="xl" scrollable ariaLabel="장비 변경 이력">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-heading font-bold text-text">변경 이력</h2>
          <p className="mt-1 text-small text-text-subtle">
            최근 200건. 지운 장비와 지운 열의 값도 남아 있어 다시 입력할 수 있습니다.
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

      {error && <p className="mt-4 text-small text-verify-fail-fg">{error}</p>}
      {!rows && !error && <p className="mt-4 text-small text-text-subtle">불러오는 중...</p>}
      {rows?.length === 0 && <p className="mt-4 text-small text-text-subtle">아직 변경 이력이 없습니다.</p>}

      <ul className="mt-4 space-y-3">
        {rows?.map((row) => (
          <li key={row.id} className="rounded-xl border border-border p-3">
            <div className="flex flex-wrap items-center gap-2 text-small">
              <span className={`rounded-full px-2 py-0.5 text-tiny font-bold ${ACTION_CLASS[row.action]}`}>
                {ACTION_LABEL[row.action]}
              </span>
              <span className="font-semibold text-text">{row.equipment_name}</span>
              <span className="text-text-subtle">
                {row.user_name ?? '알 수 없음'} · {new Date(row.created_at).toLocaleString('ko-KR')}
              </span>
            </div>
            {Object.keys(row.changes).length > 0 && (
              <dl className="mt-2 grid gap-1 text-tiny text-text-muted sm:grid-cols-2">
                {Object.entries(row.changes).map(([field, [before, after]]) => (
                  <div key={field} className="flex min-w-0 gap-1.5">
                    <dt className="shrink-0 font-semibold text-text">{field}</dt>
                    <dd className="min-w-0 break-all">
                      {isChange(row.action) ? (
                        <>
                          <span className="line-through">{before ?? '(빈칸)'}</span> → {after ?? '(빈칸)'}
                        </>
                      ) : (
                        (isRemoval(row.action) ? before : after) ?? ''
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </li>
        ))}
      </ul>
    </Modal>
  );
}
