'use client';

import { useEffect, useState } from 'react';
import Modal from '../components/Modal';
import { apiFetch, type EquipmentHistory } from '../lib/api';
import { EQUIPMENT_LABEL } from './columns';

const ACTION_LABEL: Record<EquipmentHistory['action'], string> = {
  create: '추가',
  update: '수정',
  delete: '삭제',
};

const ACTION_CLASS: Record<EquipmentHistory['action'], string> = {
  create: 'bg-verify-pass-bg text-verify-pass-fg',
  update: 'bg-brand-soft text-brand',
  delete: 'bg-verify-fail-bg text-verify-fail-fg',
};

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
            최근 200건. 삭제한 장비도 마지막 값이 남아 있어 다시 입력할 수 있습니다.
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
                    <dt className="shrink-0 font-semibold text-text">{EQUIPMENT_LABEL[field] ?? field}</dt>
                    <dd className="min-w-0 break-all">
                      {row.action === 'update' ? (
                        <>
                          <span className="line-through">{before ?? '(빈칸)'}</span> → {after ?? '(빈칸)'}
                        </>
                      ) : (
                        (row.action === 'delete' ? before : after) ?? ''
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
