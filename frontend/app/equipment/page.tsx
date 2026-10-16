'use client';

import type { ChangeEvent, KeyboardEvent } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AppShell from '../components/AppShell';
import ConfirmDialog from '../components/ConfirmDialog';
import { apiFetch, type Equipment, type EquipmentColumn } from '../lib/api';
import { toISODate } from '../lib/calendar';
import { useMe } from '../lib/useMe';
import { decodeCsvBytes } from '../projects/components/CsvImportModal';
import ColumnManager from './ColumnManager';
import HistoryModal from './HistoryModal';
import {
  cleanValues,
  equipmentGroup,
  fromCsv,
  missingHeaders,
  parseCsvText,
  sameValues,
  toCsv,
  type EquipmentValues,
} from './columns';

/** 화면의 한 줄. 저장 전 새 줄은 saved 가 없다. */
type Row = {
  key: string;
  /** 고치기 시작할 때의 서버 값. 저장할 때 이 버전으로 충돌을 확인한다. */
  saved: Equipment | null;
  draft: EquipmentValues;
  /** 내가 고치는 사이 다른 사람이 저장한 최신 값 (되돌리기로 불러온다) */
  latest?: Equipment;
  /** 내가 고치는 사이 다른 사람이 지운 줄 */
  gone?: boolean;
};

/** CSV 를 읽은 뒤 확인창에서 "추가"를 누르기 전까지 들고 있는 내용 */
type PendingImport = { lines: string[][]; rowCount: number; newColumns: string[] };

let newRowSeq = 0;

function rowFromSaved(saved: Equipment): Row {
  return { key: `id-${saved.id}`, saved, draft: { ...saved.values } };
}

const BULK_LIMIT = 500;

const BUTTON_CLASS =
  'rounded-full border border-border bg-white px-3 py-2 text-small font-semibold text-text-muted hover:bg-surface-muted';

export default function EquipmentPage() {
  const { me, loading: meLoading } = useMe();
  const [columns, setColumns] = useState<EquipmentColumn[]>([]);
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
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null);
  const [importing, setImporting] = useState(false);
  const [historyRow, setHistoryRow] = useState<Row | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const isDirty = useCallback(
    (row: Row) => row.saved === null || !sameValues(row.saved.values, row.draft, columns),
    [columns],
  );
  const dirtyCount = rows.filter(isDirty).length;

  const load = useCallback(async (keepDrafts: boolean) => {
    try {
      const [nextColumns, nextRows] = await Promise.all([
        apiFetch<EquipmentColumn[]>('/equipment/columns'),
        apiFetch<Equipment[]>('/equipment'),
      ]);
      setColumns(nextColumns);
      setRows((current) => {
        const fresh = nextRows.map(rowFromSaved);
        if (!keepDrafts) return fresh;
        // 고치던 줄과 저장 전 새 줄은 남긴다 (다른 사람 변경만 반영).
        const editing = new Map(
          current
            .filter((row) => row.saved === null || !sameValues(row.saved.values, row.draft, nextColumns))
            .map((row) => [row.key, row]),
        );
        const merged = fresh.map((row) => {
          const mine = editing.get(row.key);
          if (!mine) return row;
          // 고치는 사이 다른 사람이 같은 줄을 저장했다. 기준 버전을 최신으로 바꾸면
          // 저장할 때 상대 변경을 덮어쓰므로, 내 기준은 그대로 두고 최신 값만 따로 둔다.
          if (mine.saved && row.saved && mine.saved.version !== row.saved.version) {
            return { ...mine, latest: row.saved };
          }
          return { ...row, draft: mine.draft };
        });
        // 고치는 사이 다른 사람이 지운 줄: 입력한 내용을 버리지 않고 남겨 둔다.
        const freshKeys = new Set(fresh.map((row) => row.key));
        const gone = current
          .filter((row) => row.saved !== null && editing.has(row.key) && !freshKeys.has(row.key))
          .map((row) => ({ ...row, gone: true }));
        return [...merged, ...gone, ...current.filter((row) => row.saved === null)];
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

  // 팀원들이 함께 쓰는 표라 다른 사람의 변경이 보이도록 30초마다, 그리고 창으로 돌아올 때 다시 읽는다.
  // 고치던 줄은 load(true) 가 그대로 남긴다.
  const busyRef = useRef(false);
  // 열 관리 창·확인창이 떠 있는 동안은 쉰다 (열 이름 입력 중에 덮어쓰지 않게).
  busyRef.current =
    savingKey !== null || importing || deleting || columnsOpen || pendingImport !== null || deleteTarget !== null;
  useEffect(() => {
    if (!me) return undefined;
    const refresh = () => {
      if (document.visibilityState === 'visible' && !busyRef.current) void load(true);
    };
    const id = window.setInterval(refresh, 30_000);
    window.addEventListener('focus', refresh);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('focus', refresh);
    };
  }, [me, load]);

  // 상단 탭·사이드바 링크로 옮길 때는 beforeunload 가 뜨지 않으므로 직접 묻는다.
  useEffect(() => {
    if (dirtyCount === 0) return undefined;
    const handler = (event: MouseEvent) => {
      const link = (event.target as HTMLElement | null)?.closest('a[href]');
      if (!link || link.getAttribute('target') === '_blank') return;
      if (!window.confirm(`저장하지 않은 줄 ${dirtyCount}개가 있습니다. 이동하면 입력한 내용이 사라집니다. 이동할까요?`)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    document.addEventListener('click', handler, true);
    return () => document.removeEventListener('click', handler, true);
  }, [dirtyCount]);

  const groups = useMemo(() => {
    const names = new Set(
      rows.filter((row) => row.saved).map((row) => equipmentGroup(row.saved!.values, columns)),
    );
    return ['전체', ...Array.from(names).sort((a, b) => a.localeCompare(b, 'ko-KR'))];
  }, [rows, columns]);

  const visibleRows = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (row.saved === null) return true; // 새 줄은 항상 보인다
      if (group !== '전체' && equipmentGroup(row.saved.values, columns) !== group) return false;
      if (!keyword) return true;
      return columns.some(({ id }) => (row.draft[id] ?? '').toLowerCase().includes(keyword));
    });
  }, [rows, columns, search, group]);

  function setCell(rowKey: string, columnId: number, value: string) {
    setRows((current) =>
      current.map((row) =>
        row.key === rowKey ? { ...row, draft: { ...row.draft, [columnId]: value } } : row,
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
    if (row.saved === null || row.gone) {
      setRows((current) => current.filter((item) => item.key !== row.key));
      return;
    }
    // 다른 사람이 먼저 고쳤으면 그 최신 값으로 되돌린다.
    const saved = row.latest ?? row.saved;
    setRows((current) =>
      current.map((item) => (item.key === row.key ? rowFromSaved(saved) : item)),
    );
  }

  async function saveRow(row: Row) {
    if (!isDirty(row) || savingKey) return;
    const values = cleanValues(row.draft, columns);
    if (Object.keys(values).length === 0) {
      setRowErrors((current) => ({ ...current, [row.key]: '한 칸 이상 입력해 주세요.' }));
      return;
    }
    setSavingKey(row.key);
    setMessage('');
    try {
      // 다른 사람이 지운 줄은 새 줄로 다시 만든다.
      const saved = row.saved && !row.gone
        ? await apiFetch<Equipment>(`/equipment/${row.saved.id}`, {
            method: 'PUT',
            body: JSON.stringify({ values, version: row.saved.version }),
          })
        : await apiFetch<Equipment>('/equipment', {
            method: 'POST',
            body: JSON.stringify({ values }),
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
    setRows((current) => [...current, { key, saved: null, draft: {} }]);
    setGroup('전체');
    // 새 줄의 첫 칸으로 바로 이동
    window.setTimeout(() => {
      document.querySelector<HTMLInputElement>(`[data-row="${key}"] input`)?.focus();
    }, 0);
  }

  function duplicateRow(row: Row) {
    newRowSeq += 1;
    const key = `new-${newRowSeq}`;
    setRows((current) => [...current, { key, saved: null, draft: { ...row.draft } }]);
    setGroup('전체');
    window.setTimeout(() => {
      document.querySelector<HTMLInputElement>(`[data-row="${key}"] input`)?.focus();
    }, 0);
  }

  function rowName(row: Row): string {
    const first = columns[0];
    return (first && row.saved?.values[first.id]) || '이름 없는 장비';
  }

  async function confirmDelete() {
    const target = deleteTarget;
    if (!target) return;
    if (target.saved === null || target.gone) {
      revertRow(target);
      setDeleteTarget(null);
      return;
    }
    setDeleting(true);
    try {
      await apiFetch<void>(`/equipment/${target.saved.id}`, { method: 'DELETE' });
      setRows((current) => current.filter((row) => row.key !== target.key));
      setMessage(`${rowName(target)} 을(를) 삭제했습니다. 변경 이력에서 지운 값을 볼 수 있습니다.`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDeleteTarget(null);
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
    const saved = rows.flatMap((row) => (row.saved ? [row.saved.values] : []));
    const blob = new Blob([toCsv(columns, saved)], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    // toISOString 은 UTC 라 오전 9시 전에는 전날로 찍힌다. 로컬 날짜를 쓴다.
    a.download = `장비현황_${toISODate(new Date())}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const lines = parseCsvText(decodeCsvBytes(reader.result as ArrayBuffer));
      const [header, ...body] = lines;
      const rowCount = body.filter((cells) => cells.some((cell) => cell.trim())).length;
      if (!header || rowCount === 0) {
        setError('가져올 줄이 없습니다. 첫 줄은 열 이름, 둘째 줄부터 장비 한 줄씩이어야 합니다.');
        return;
      }
      setError('');
      setPendingImport({ lines, rowCount, newColumns: missingHeaders(header, columns) });
    };
    reader.readAsArrayBuffer(file);
  }

  async function confirmImport() {
    if (!pendingImport) return;
    setImporting(true);
    try {
      // 표에 없는 머리글은 새 열로 먼저 만든다.
      for (const label of pendingImport.newColumns) {
        await apiFetch('/equipment/columns', { method: 'POST', body: JSON.stringify({ label }) });
      }
      const nextColumns = await apiFetch<EquipmentColumn[]>('/equipment/columns');
      const parsed = fromCsv(pendingImport.lines, nextColumns);
      // 서버는 한 번에 500줄까지 받으므로 나눠 보낸다.
      let createdCount = 0;
      for (let start = 0; start < parsed.length; start += BULK_LIMIT) {
        const chunk = parsed.slice(start, start + BULK_LIMIT);
        const created = await apiFetch<Equipment[]>('/equipment/bulk', {
          method: 'POST',
          body: JSON.stringify({ rows: chunk.map((values) => ({ values })) }),
        });
        createdCount += created.length;
      }
      setMessage(`${createdCount}줄을 추가했습니다.`);
      await load(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPendingImport(null);
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
          <button type="button" onClick={() => void load(true)} className={BUTTON_CLASS}>
            새로고침
          </button>
          <button type="button" onClick={() => setHistoryOpen(true)} className={BUTTON_CLASS}>
            변경 이력
          </button>
          <button
            type="button"
            onClick={() => setColumnsOpen(true)}
            title="열 이름 바꾸기, 열 추가·삭제·순서 바꾸기"
            className={BUTTON_CLASS}
          >
            열 관리
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            title="첫 줄이 열 이름인 CSV 를 맨 아래에 추가합니다. 기존 줄은 바뀌지 않고, 표에 없는 열은 새로 만듭니다."
            className={BUTTON_CLASS}
          >
            CSV 가져오기
          </button>
          <button
            type="button"
            onClick={exportCsv}
            title="지금 저장된 표를 CSV 로 받습니다. 메모장이나 엑셀로 열 수 있습니다."
            className={BUTTON_CLASS}
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
          placeholder="검색 (모든 칸)"
          className="ml-auto w-64 max-w-full rounded-full border border-border bg-white px-4 py-1.5 text-small"
        />
      </div>

      {dirtyCount > 0 && (
        <p className="mt-3 text-small font-semibold text-verify-warn-fg">
          저장하지 않은 줄 {dirtyCount}개 (노란 줄). 저장하지 않고 나가면 사라집니다.
        </p>
      )}

      {/* 열이 많아 옆으로 길다. 머리글은 위에, 첫 열(장비 이름)은 왼쪽에 고정한다. */}
      <div className="mt-3 max-h-[70vh] overflow-auto rounded-2xl border border-border bg-white">
        <table className="min-w-max border-collapse text-small">
          <thead className="sticky top-0 z-30 bg-surface-muted text-left text-tiny font-bold text-text-muted">
            <tr>
              {columns.map((column, index) => (
                <th
                  key={column.id}
                  className={`min-w-[7rem] border-b border-border px-2 py-2 ${
                    index === 0 ? 'sticky left-0 z-20 border-r bg-surface-muted' : ''
                  }`}
                >
                  {column.label}
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
                  {columns.map((column, index) => (
                    <td
                      key={column.id}
                      className={`min-w-[7rem] p-0 ${
                        index === 0
                          ? `sticky left-0 z-10 border-r border-border ${dirty ? 'bg-verify-warn-bg' : 'bg-white'}`
                          : ''
                      }`}
                    >
                      <input
                        value={row.draft[column.id] ?? ''}
                        title={row.draft[column.id] || undefined}
                        onChange={(event) => setCell(row.key, column.id, event.target.value)}
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
                          {row.saved && !row.gone && (
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
                        onClick={() => duplicateRow(row)}
                        title="이 줄 내용으로 새 줄을 만듭니다. 저장을 눌러야 추가됩니다."
                        className="shrink-0 rounded-full border border-border px-2.5 py-1 text-tiny text-text-muted hover:bg-surface-muted"
                      >
                        복제
                      </button>
                      {row.saved && (
                        <button
                          type="button"
                          onClick={() => setHistoryRow(row)}
                          className="shrink-0 rounded-full border border-border px-2.5 py-1 text-tiny text-text-muted hover:bg-surface-muted"
                        >
                          이력
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(row)}
                        className="shrink-0 rounded-full border border-border px-2.5 py-1 text-tiny text-verify-fail-fg hover:bg-verify-fail-bg"
                      >
                        삭제
                      </button>
                    </div>
                    {row.latest && !rowError && (
                      <p className="mt-1 max-w-[240px] whitespace-normal text-tiny text-verify-warn-fg">
                        고치는 사이 {row.latest.updated_by_name ?? '다른 사람'}님이 이 줄을 저장했습니다. 되돌리기를 누르면 최신 내용을 불러옵니다.
                      </p>
                    )}
                    {row.gone && !rowError && (
                      <p className="mt-1 max-w-[240px] whitespace-normal text-tiny text-verify-warn-fg">
                        고치는 사이 다른 사람이 이 줄을 삭제했습니다. 저장하면 새 줄로 다시 만듭니다.
                      </p>
                    )}
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
            {rows.length === 0
              ? '아직 등록된 장비가 없습니다. "+ 장비 추가"나 "CSV 가져오기"로 시작하세요.'
              : '조건에 맞는 장비가 없습니다.'}
          </p>
        )}
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="장비 삭제"
        description={
          deleteTarget?.saved
            ? `${rowName(deleteTarget)} 줄을 삭제합니다. 모든 팀원의 표에서 사라지며, 지운 값은 변경 이력에서 확인할 수 있습니다.`
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
                `${pendingImport.rowCount}줄을 표 맨 아래에 추가합니다. 기존 줄은 바뀌지 않습니다.`,
                pendingImport.newColumns.length > 0
                  ? `표에 없는 열 ${pendingImport.newColumns.length}개를 새로 만듭니다: ${pendingImport.newColumns.join(', ')}`
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

      <ColumnManager
        open={columnsOpen}
        columns={columns}
        onClose={() => setColumnsOpen(false)}
        onChanged={() => load(true)}
      />
      <HistoryModal open={historyOpen} onClose={() => setHistoryOpen(false)} />
      <HistoryModal
        open={historyRow !== null}
        equipmentId={historyRow?.saved?.id}
        title={historyRow ? `${rowName(historyRow)} 변경 이력` : undefined}
        onClose={() => setHistoryRow(null)}
      />
    </AppShell>
  );
}
