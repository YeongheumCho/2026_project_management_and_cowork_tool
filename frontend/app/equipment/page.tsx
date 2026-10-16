'use client';

import type { ChangeEvent, KeyboardEvent } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AppShell from '../components/AppShell';
import ConfirmDialog from '../components/ConfirmDialog';
import { apiFetch, type Equipment, type EquipmentFields } from '../lib/api';
import { useMe } from '../lib/useMe';
import { decodeCsvBytes, parseCsvLine } from '../projects/components/CsvImportModal';
import HistoryModal from './HistoryModal';
import {
  EQUIPMENT_COLUMNS,
  emptyEquipment,
  equipmentGroup,
  fromCsv,
  pickFields,
  sameFields,
  toCsv,
  type EquipmentKey,
} from './columns';

/** 화면의 한 줄. 저장 전 새 줄은 id 가 없다. */
type Row = {
  key: string;
  saved: Equipment | null;
  draft: EquipmentFields;
};

type PendingImport = { rows: EquipmentFields[]; skipped: number; unknownHeaders: string[] };

let newRowSeq = 0;

function rowFromSaved(saved: Equipment): Row {
  return { key: `id-${saved.id}`, saved, draft: pickFields(saved) };
}

function isDirty(row: Row): boolean {
  return row.saved === null || !sameFields(row.saved, row.draft);
}

export default function EquipmentPage() {
  const { me, loading: meLoading } = useMe();
  const [rows, setRows] = useState<Row[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [group, setGroup] = useState('전체');
  const [deleteTarget, setDeleteTarget] = useState<Row | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const dirtyCount = rows.filter(isDirty).length;

  const load = useCallback(async (keepDrafts: boolean) => {
    try {
      const next = await apiFetch<Equipment[]>('/equipment');
      setRows((current) => {
        const fresh = next.map(rowFromSaved);
        if (!keepDrafts) return fresh;
        // 고치던 줄과 저장 전 새 줄은 남긴다 (다른 사람 변경만 반영).
        const editing = new Map(current.filter(isDirty).map((row) => [row.key, row]));
        const merged = fresh.map((row) => {
          const mine = editing.get(row.key);
          return mine ? { ...row, draft: mine.draft } : row;
        });
        return [...merged, ...current.filter((row) => row.saved === null)];
      });
      setLoaded(true);
      setError('');
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    if (me) void load(false);
  }, [me, load]);

  // 저장하지 않은 줄이 있으면 페이지를 떠나기 전에 묻는다.
  useEffect(() => {
    if (dirtyCount === 0) return undefined;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirtyCount]);

  const groups = useMemo(() => {
    const names = new Set(rows.map((row) => equipmentGroup(row.draft.name || row.saved?.name || '')));
    return ['전체', ...Array.from(names).sort((a, b) => a.localeCompare(b, 'ko-KR'))];
  }, [rows]);

  const visibleRows = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (row.saved === null) return true; // 새 줄은 항상 보인다
      if (group !== '전체' && equipmentGroup(row.saved.name) !== group) return false;
      if (!keyword) return true;
      return EQUIPMENT_COLUMNS.some(({ key }) =>
        (row.draft[key] ?? '').toLowerCase().includes(keyword),
      );
    });
  }, [rows, search, group]);

  function setCell(rowKey: string, key: EquipmentKey, value: string) {
    setRows((current) =>
      current.map((row) =>
        row.key === rowKey ? { ...row, draft: { ...row.draft, [key]: value } } : row,
      ),
    );
  }

  function clearRowError(rowKey: string) {
    setRowErrors((current) => {
      if (!(rowKey in current)) return current;
      const next = { ...current };
      delete next[rowKey];
      return next;
    });
  }

  function revertRow(row: Row) {
    clearRowError(row.key);
    if (row.saved === null) {
      setRows((current) => current.filter((item) => item.key !== row.key));
      return;
    }
    const saved = row.saved;
    setRows((current) =>
      current.map((item) => (item.key === row.key ? rowFromSaved(saved) : item)),
    );
  }

  async function saveRow(row: Row) {
    if (!isDirty(row) || savingKey) return;
    if (!row.draft.name.trim()) {
      setRowErrors((current) => ({ ...current, [row.key]: '장비 이름을 입력해 주세요.' }));
      return;
    }
    setSavingKey(row.key);
    setMessage('');
    try {
      const saved = row.saved
        ? await apiFetch<Equipment>(`/equipment/${row.saved.id}`, {
            method: 'PUT',
            body: JSON.stringify({ ...row.draft, version: row.saved.version }),
          })
        : await apiFetch<Equipment>('/equipment', {
            method: 'POST',
            body: JSON.stringify(row.draft),
          });
      setRows((current) =>
        current.map((item) => (item.key === row.key ? rowFromSaved(saved) : item)),
      );
      clearRowError(row.key);
    } catch (err) {
      setRowErrors((current) => ({ ...current, [row.key]: (err as Error).message }));
    } finally {
      setSavingKey(null);
    }
  }

  function addRow() {
    newRowSeq += 1;
    const key = `new-${newRowSeq}`;
    setRows((current) => [...current, { key, saved: null, draft: emptyEquipment() }]);
    setGroup('전체');
    // 새 줄의 첫 칸으로 바로 이동
    window.setTimeout(() => {
      document.querySelector<HTMLInputElement>(`[data-row="${key}"] input`)?.focus();
    }, 0);
  }

  async function confirmDelete() {
    const target = deleteTarget;
    if (!target) return;
    if (target.saved === null) {
      revertRow(target);
      setDeleteTarget(null);
      return;
    }
    setDeleting(true);
    try {
      await apiFetch<void>(`/equipment/${target.saved.id}`, { method: 'DELETE' });
      setRows((current) => current.filter((row) => row.key !== target.key));
      setMessage(`${target.saved.name} 을(를) 삭제했습니다. 변경 이력에서 지운 값을 볼 수 있습니다.`);
      setDeleteTarget(null);
    } catch (err) {
      setError((err as Error).message);
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>, row: Row) {
    if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void saveRow(row);
    }
  }

  function exportCsv() {
    const saved = rows.flatMap((row) => (row.saved ? [row.saved] : []));
    const blob = new Blob([toCsv(saved)], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `장비현황_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = decodeCsvBytes(reader.result as ArrayBuffer);
      const lines = text
        .split(/\r?\n/)
        .filter((line) => line.trim())
        .map(parseCsvLine);
      const parsed = fromCsv(lines);
      if (parsed.rows.length === 0) {
        setError('가져올 줄이 없습니다. 첫 줄에 "장비" 열이 있고, 장비 이름이 채워져 있는지 확인해 주세요.');
        return;
      }
      setError('');
      setPendingImport(parsed);
    };
    reader.readAsArrayBuffer(file);
  }

  async function confirmImport() {
    if (!pendingImport) return;
    setImporting(true);
    try {
      await apiFetch<Equipment[]>('/equipment/bulk', {
        method: 'POST',
        body: JSON.stringify({ rows: pendingImport.rows }),
      });
      setMessage(`${pendingImport.rows.length}줄을 추가했습니다.`);
      setPendingImport(null);
      await load(true);
    } catch (err) {
      setError((err as Error).message);
      setPendingImport(null);
    } finally {
      setImporting(false);
    }
  }

  if (meLoading || !me) {
    return <main className="p-8 text-text">불러오는 중...</main>;
  }

  return (
    <AppShell me={me}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-[-0.3px] text-text">장비 현황</h1>
          <p className="mt-1 text-small text-text-subtle">
            누구나 보고 고칠 수 있습니다. 칸을 고친 뒤 Enter 나 저장을 누르면 그 줄만 저장되고, 변경 이력에 남습니다.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void load(true)}
            className="rounded-full border border-border bg-white px-3 py-2 text-small font-semibold text-text-muted hover:bg-surface-muted"
          >
            새로고침
          </button>
          <button
            type="button"
            onClick={() => setHistoryOpen(true)}
            className="rounded-full border border-border bg-white px-3 py-2 text-small font-semibold text-text-muted hover:bg-surface-muted"
          >
            변경 이력
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            title="첫 줄이 열 이름(장비, 장비 번호, 성명 …)인 CSV 를 맨 아래에 추가합니다. 기존 줄은 바뀌지 않습니다."
            className="rounded-full border border-border bg-white px-3 py-2 text-small font-semibold text-text-muted hover:bg-surface-muted"
          >
            CSV 가져오기
          </button>
          <button
            type="button"
            onClick={exportCsv}
            title="지금 저장된 표를 CSV 로 받습니다. 메모장이나 엑셀로 열 수 있습니다."
            className="rounded-full border border-border bg-white px-3 py-2 text-small font-semibold text-text-muted hover:bg-surface-muted"
          >
            CSV 추출
          </button>
          <button
            type="button"
            onClick={addRow}
            className="rounded-full bg-brand px-4 py-2 text-small font-bold text-white hover:bg-brand-hover"
          >
            + 장비 추가
          </button>
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} />
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded-lg bg-verify-fail-bg px-3 py-2 text-small text-verify-fail-fg">{error}</p>
      )}
      {message && (
        <p className="mt-4 rounded-lg bg-verify-pass-bg px-3 py-2 text-small text-verify-pass-fg">{message}</p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {groups.map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => setGroup(name)}
            className={`rounded-full px-3 py-1.5 text-small font-semibold ${
              group === name ? 'bg-brand text-white' : 'border border-border bg-white text-text-muted'
            }`}
          >
            {name}
          </button>
        ))}
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="검색 (장비·성명·IP·제어기 …)"
          className="ml-auto w-64 max-w-full rounded-full border border-border bg-white px-4 py-1.5 text-small"
        />
      </div>

      {dirtyCount > 0 && (
        <p className="mt-3 text-small font-semibold text-verify-warn-fg">
          저장하지 않은 줄 {dirtyCount}개 (노란 줄). 저장하지 않고 나가면 사라집니다.
        </p>
      )}

      <div className="mt-3 overflow-x-auto rounded-2xl border border-border bg-white">
        <table className="min-w-max border-collapse text-small">
          <thead className="bg-surface-muted text-left text-tiny font-bold text-text-muted">
            <tr>
              {EQUIPMENT_COLUMNS.map((column) => (
                <th key={column.key} className={`${column.width} border-b border-border px-2 py-2`}>
                  {column.label}
                  {column.key === 'name' && <span className="text-verify-fail-fg"> *</span>}
                </th>
              ))}
              <th className="w-36 border-b border-border px-2 py-2">마지막 수정</th>
              <th className="w-32 border-b border-border px-2 py-2">작업</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => {
              const dirty = isDirty(row);
              const rowError = rowErrors[row.key];
              return (
                <tr
                  key={row.key}
                  data-row={row.key}
                  className={`border-b border-border align-top ${dirty ? 'bg-verify-warn-bg/50' : ''}`}
                >
                  {EQUIPMENT_COLUMNS.map((column) => (
                    <td key={column.key} className={`${column.width} p-0`}>
                      <input
                        value={row.draft[column.key] ?? ''}
                        onChange={(event) => setCell(row.key, column.key, event.target.value)}
                        onKeyDown={(event) => handleKeyDown(event, row)}
                        aria-label={column.label}
                        className="w-full bg-transparent px-2 py-2 text-small text-text outline-none focus:bg-white focus:ring-2 focus:ring-brand/40"
                      />
                    </td>
                  ))}
                  <td className="px-2 py-2 text-tiny text-text-subtle">
                    {row.saved ? (
                      <>
                        {row.saved.updated_by_name ?? '-'}
                        <br />
                        {new Date(row.saved.updated_at).toLocaleString('ko-KR', {
                          month: 'numeric',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </>
                    ) : (
                      '새 줄'
                    )}
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="flex items-center gap-1 whitespace-nowrap">
                      {dirty && (
                        <>
                          <button
                            type="button"
                            disabled={savingKey !== null}
                            onClick={() => void saveRow(row)}
                            className="shrink-0 rounded-full bg-brand px-2.5 py-1 text-tiny font-bold text-white disabled:opacity-50"
                          >
                            {savingKey === row.key ? '저장 중' : '저장'}
                          </button>
                          {row.saved && (
                            <button
                              type="button"
                              onClick={() => revertRow(row)}
                              className="shrink-0 rounded-full border border-border px-2.5 py-1 text-tiny text-text-muted"
                            >
                              되돌리기
                            </button>
                          )}
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(row)}
                        className="shrink-0 rounded-full border border-border px-2.5 py-1 text-tiny text-verify-fail-fg hover:bg-verify-fail-bg"
                      >
                        삭제
                      </button>
                    </div>
                    {rowError && (
                      <p className="mt-1 max-w-[240px] whitespace-normal text-tiny text-verify-fail-fg">{rowError}</p>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {loaded && visibleRows.length === 0 && (
          <p className="px-4 py-8 text-center text-small text-text-subtle">
            {rows.length === 0 ? '아직 등록된 장비가 없습니다. "+ 장비 추가"나 "CSV 가져오기"로 시작하세요.' : '조건에 맞는 장비가 없습니다.'}
          </p>
        )}
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="장비 삭제"
        description={
          deleteTarget?.saved
            ? `${deleteTarget.saved.name} 줄을 삭제합니다. 모든 팀원의 표에서 사라지며, 지운 값은 변경 이력에서 확인할 수 있습니다.`
            : '저장하지 않은 새 줄을 지웁니다.'
        }
        confirmLabel="삭제"
        variant="danger"
        busy={deleting}
        onConfirm={() => void confirmDelete()}
        onClose={() => setDeleteTarget(null)}
      />

      <ConfirmDialog
        open={pendingImport !== null}
        title="CSV 가져오기"
        description={
          pendingImport
            ? [
                `${pendingImport.rows.length}줄을 표 맨 아래에 추가합니다. 기존 줄은 바뀌지 않습니다.`,
                pendingImport.skipped > 0 ? `장비 이름이 빈 ${pendingImport.skipped}줄은 건너뜁니다.` : '',
                pendingImport.unknownHeaders.length > 0
                  ? `모르는 열은 무시합니다: ${pendingImport.unknownHeaders.join(', ')}`
                  : '',
              ]
                .filter(Boolean)
                .join(' ')
            : ''
        }
        confirmLabel="추가"
        variant="primary"
        busy={importing}
        onConfirm={() => void confirmImport()}
        onClose={() => setPendingImport(null)}
      />

      <HistoryModal open={historyOpen} onClose={() => setHistoryOpen(false)} />
    </AppShell>
  );
}
