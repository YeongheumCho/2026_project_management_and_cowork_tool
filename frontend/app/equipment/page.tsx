'use client';

import type { ChangeEvent, KeyboardEvent, MouseEvent as ReactMouseEvent } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AppShell from '../components/AppShell';
import ConfirmDialog from '../components/ConfirmDialog';
import {
  apiFetch,
  type Equipment,
  type EquipmentBoard,
  type EquipmentCellFormat,
  type EquipmentColumn,
} from '../lib/api';
import { toISODate } from '../lib/calendar';
import { useMe } from '../lib/useMe';
import { decodeCsvBytes } from '../projects/components/CsvImportModal';
import BoardManager from './BoardManager';
import ColumnManager from './ColumnManager';
import HistoryModal from './HistoryModal';
import {
  cleanFormats,
  cleanValues,
  equipmentGroup,
  fromCsv,
  missingHeaders,
  parseCsvText,
  patchFormat,
  sameFormats,
  sameValues,
  toCsv,
  type EquipmentFormats,
  type EquipmentValues,
} from './columns';

/** 화면의 한 줄. 저장 전 새 줄은 saved 가 없다. */
type Row = {
  key: string;
  /** 고치기 시작할 때의 서버 값. 저장할 때 이 버전으로 충돌을 확인한다. */
  saved: Equipment | null;
  draft: EquipmentValues;
  /** B-109: 고치는 중인 칸 서식 (값과 같이 저장된다) */
  formats: EquipmentFormats;
  /** 내가 고치는 사이 다른 사람이 저장한 최신 값 (되돌리기로 불러온다) */
  latest?: Equipment;
  /** 내가 고치는 사이 다른 사람이 지운 줄 */
  gone?: boolean;
};

/** CSV 를 읽은 뒤 확인창에서 "추가"를 누르기 전까지 들고 있는 내용 */
type PendingImport = { lines: string[][]; rowCount: number; newColumns: string[] };

let newRowSeq = 0;

function rowFromSaved(saved: Equipment): Row {
  return {
    key: `id-${saved.id}`,
    saved,
    draft: { ...saved.values },
    formats: { ...(saved.formats ?? {}) },
  };
}

/** 저장 전 새 줄이거나, 값·서식이 저장된 것과 다르면 고치는 중이다. */
function rowDirty(row: Row, columns: EquipmentColumn[]): boolean {
  return (
    row.saved === null ||
    !sameValues(row.saved.values, row.draft, columns) ||
    !sameFormats(row.saved.formats ?? {}, row.formats, columns)
  );
}

// B-112: 마지막으로 보던 그룹을 기억한다.
const BOARD_KEY = 'surelog.equipment.boardId';

function readStoredBoardId(): number | null {
  try {
    const raw = window.localStorage.getItem(BOARD_KEY);
    return raw ? Number(raw) : null;
  } catch {
    return null;
  }
}

function storeBoardId(id: number) {
  try {
    window.localStorage.setItem(BOARD_KEY, String(id));
  } catch {
    // 저장소를 쓸 수 없으면 이번 화면에서만 유지한다.
  }
}

// B-109: 서식 도구의 색. 엑셀의 연한 채우기 색과 진한 글자 색에서 골랐다.
const FILL_COLORS: { value: string; label: string }[] = [
  { value: '#fff2cc', label: '노랑' },
  { value: '#fce4d6', label: '주황' },
  { value: '#ffc7ce', label: '빨강' },
  { value: '#e2efda', label: '초록' },
  { value: '#ddebf7', label: '파랑' },
  { value: '#e4dfec', label: '보라' },
  { value: '#ededed', label: '회색' },
];
const TEXT_COLORS: { value: string; label: string }[] = [
  { value: '#c00000', label: '빨강' },
  { value: '#b26a00', label: '주황' },
  { value: '#2e7d32', label: '초록' },
  { value: '#0b5cad', label: '파랑' },
  { value: '#6a1b9a', label: '보라' },
  { value: '#7f7f7f', label: '회색' },
];
const MIN_COLUMN_WIDTH = 60;
const MAX_COLUMN_WIDTH = 800;

const BULK_LIMIT = 500;

const BUTTON_CLASS =
  'rounded-full border border-border bg-white px-3 py-2 text-small font-semibold text-text-muted hover:bg-surface-muted';

export default function EquipmentPage() {
  const { me, loading: meLoading } = useMe();
  const isAdmin = me?.role === 'admin';
  // B-112: 볼 수 있는 장비 그룹과 지금 보는 그룹
  const [boards, setBoards] = useState<EquipmentBoard[]>([]);
  const [boardId, setBoardId] = useState<number | null>(null);
  const [boardsOpen, setBoardsOpen] = useState(false);
  // B-109: 서식을 입힐 칸(마지막으로 누른 칸)과 끌어서 바꾸는 중인 열 너비
  const [activeCell, setActiveCell] = useState<{ rowKey: string; columnId: number } | null>(null);
  const [formatWholeRow, setFormatWholeRow] = useState(false);
  const [dragWidth, setDragWidth] = useState<{ columnId: number; width: number } | null>(null);
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
  // C-13: 여러 줄을 골라 한꺼번에 지운다. 저장된 줄만 고를 수 있다.
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const isDirty = useCallback((row: Row) => rowDirty(row, columns), [columns]);
  const dirtyCount = rows.filter(isDirty).length;
  const board = boards.find((item) => item.id === boardId) ?? null;
  const boardQuery = `?board_id=${boardId ?? ''}`;

  const loadBoards = useCallback(async (focusBoardId?: number) => {
    try {
      const next = await apiFetch<EquipmentBoard[]>('/equipment/boards');
      setBoards(next);
      setBoardId((current) => {
        const wanted = focusBoardId ?? current ?? readStoredBoardId();
        const chosen = next.find((item) => item.id === wanted) ?? next[0] ?? null;
        return chosen ? chosen.id : null;
      });
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    if (me) void loadBoards();
  }, [me, loadBoards]);

  // 느리게 도착한 이전 그룹의 응답이 지금 그룹의 표를 덮어쓰지 않게 한다.
  const boardIdRef = useRef<number | null>(null);
  boardIdRef.current = boardId;

  const load = useCallback(async (keepDrafts: boolean) => {
    if (boardId === null) return;
    try {
      const [nextColumns, nextRows] = await Promise.all([
        apiFetch<EquipmentColumn[]>(`/equipment/columns?board_id=${boardId}`),
        apiFetch<Equipment[]>(`/equipment?board_id=${boardId}`),
      ]);
      if (boardIdRef.current !== boardId) return;
      setColumns(nextColumns);
      setRows((current) => {
        const fresh = nextRows.map(rowFromSaved);
        if (!keepDrafts) return fresh;
        // 고치던 줄과 저장 전 새 줄은 남긴다 (다른 사람 변경만 반영).
        const editing = new Map(
          current
            .filter((row) => rowDirty(row, nextColumns))
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
          return { ...row, draft: mine.draft, formats: mine.formats };
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
      // 그 사이 그룹이 지워졌거나 볼 수 없게 됐을 수 있다. 목록을 다시 읽어 다른 그룹으로 옮긴다.
      void loadBoards();
    }
  }, [boardId, loadBoards]);

  useEffect(() => {
    if (me && boardId !== null) void load(false);
  }, [me, boardId, load]);

  function switchBoard(nextId: number) {
    if (nextId === boardId) return;
    if (
      dirtyCount > 0 &&
      !window.confirm(`저장하지 않은 줄 ${dirtyCount}개가 있습니다. 다른 장비 현황으로 옮기면 입력한 내용이 사라집니다. 옮길까요?`)
    ) {
      return;
    }
    storeBoardId(nextId);
    setRows([]);
    setColumns([]);
    setLoaded(false);
    setSelected(new Set());
    setRowErrors({});
    setActiveCell(null);
    setGroup('전체');
    setSearch('');
    setMessage('');
    setBoardId(nextId);
  }

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
    savingKey !== null ||
    importing ||
    deleting ||
    columnsOpen ||
    boardsOpen ||
    dragWidth !== null ||
    pendingImport !== null ||
    deleteTarget !== null ||
    bulkConfirmOpen ||
    bulkDeleting;

  // 다른 사람이 지운 줄은 선택에서 뺀다.
  useEffect(() => {
    const savedIds = new Set(rows.flatMap((row) => (row.saved && !row.gone ? [row.saved.id] : [])));
    setSelected((current) => {
      const next = new Set([...current].filter((id) => savedIds.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [rows]);
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

  // B-109: 고른 칸(또는 그 줄 전체)에 서식을 입힌다. 값처럼 저장을 눌러야 반영된다.
  function applyFormat(patch: { bg?: string | null; fg?: string | null; bold?: boolean } | 'clear') {
    if (!activeCell) return;
    setRows((current) =>
      current.map((row) => {
        if (row.key !== activeCell.rowKey) return row;
        const ids = formatWholeRow ? columns.map((column) => column.id) : [activeCell.columnId];
        const formats = { ...row.formats };
        for (const id of ids) {
          if (patch === 'clear') delete formats[id];
          else formats[id] = patchFormat(formats[id], patch);
        }
        return { ...row, formats };
      }),
    );
  }

  const activeRow = activeCell ? rows.find((row) => row.key === activeCell.rowKey) : undefined;
  const activeFormat: EquipmentCellFormat =
    (activeRow && activeCell && activeRow.formats[activeCell.columnId]) || {};

  // B-109: 머리글 오른쪽 끝을 끌어 열 너비를 바꾼다. 놓으면 서버에 저장되어 모두 같은 너비로 본다.
  function startResize(event: ReactMouseEvent, column: EquipmentColumn) {
    event.preventDefault();
    event.stopPropagation();
    const header = (event.currentTarget as HTMLElement).closest('th');
    const startWidth = column.width ?? header?.getBoundingClientRect().width ?? 112;
    const startX = event.clientX;
    let latest = Math.round(startWidth);
    const onMove = (moveEvent: MouseEvent) => {
      latest = Math.round(
        Math.min(MAX_COLUMN_WIDTH, Math.max(MIN_COLUMN_WIDTH, startWidth + moveEvent.clientX - startX)),
      );
      setDragWidth({ columnId: column.id, width: latest });
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      setDragWidth(null);
      // 끌지 않고 누르기만 했으면 너비를 바꾸지 않는다.
      if (latest !== Math.round(startWidth)) void saveWidth(column, latest);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  async function saveWidth(column: EquipmentColumn, width: number | null) {
    // 먼저 화면에 반영하고, 실패하면 되돌린다.
    setColumns((current) => current.map((item) => (item.id === column.id ? { ...item, width } : item)));
    try {
      await apiFetch<EquipmentColumn>(`/equipment/columns/${column.id}/width`, {
        method: 'PUT',
        body: JSON.stringify({ width }),
      });
    } catch (err) {
      setColumns((current) =>
        current.map((item) => (item.id === column.id ? { ...item, width: column.width } : item)),
      );
      setError((err as Error).message);
    }
  }

  function columnStyle(column: EquipmentColumn) {
    const width = dragWidth?.columnId === column.id ? dragWidth.width : column.width;
    return width ? { width, minWidth: width, maxWidth: width } : undefined;
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
    const formats = cleanFormats(row.formats, columns);
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
            body: JSON.stringify({ values, formats, version: row.saved.version }),
          })
        : await apiFetch<Equipment>(`/equipment${boardQuery}`, {
            method: 'POST',
            body: JSON.stringify({ values, formats }),
          });
      setRows((current) =>
        current.map((item) => (item.key === row.key ? rowFromSaved(saved) : item)),
      );
      clearRowError(row.key);
      // 새 줄은 저장하면 줄 키가 바뀐다. 서식 도구가 고른 칸을 놓치지 않게 따라간다.
      setActiveCell((current) =>
        current && current.rowKey === row.key ? { ...current, rowKey: `id-${saved.id}` } : current,
      );
    } catch (err) {
      setRowErrors((current) => ({ ...current, [row.key]: (err as Error).message }));
    } finally {
      setSavingKey(null);
    }
  }

  function addRow() {
    newRowSeq += 1;
    const key = `new-${newRowSeq}`;
    setRows((current) => [...current, { key, saved: null, draft: {}, formats: {} }]);
    setGroup('전체');
    // 새 줄의 첫 칸으로 바로 이동
    window.setTimeout(() => {
      document.querySelector<HTMLTextAreaElement>(`[data-row="${key}"] textarea`)?.focus();
    }, 0);
  }

  function duplicateRow(row: Row) {
    newRowSeq += 1;
    const key = `new-${newRowSeq}`;
    setRows((current) => [
      ...current,
      { key, saved: null, draft: { ...row.draft }, formats: { ...row.formats } },
    ]);
    setGroup('전체');
    window.setTimeout(() => {
      document.querySelector<HTMLTextAreaElement>(`[data-row="${key}"] textarea`)?.focus();
    }, 0);
  }

  const selectableIds = visibleRows.flatMap((row) => (row.saved && !row.gone ? [row.saved.id] : []));
  const allVisibleSelected = selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));
  const someVisibleSelected = selectableIds.some((id) => selected.has(id));

  function toggleSelected(id: number) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllVisible() {
    setSelected((current) => {
      const next = new Set(current);
      if (allVisibleSelected) selectableIds.forEach((id) => next.delete(id));
      else selectableIds.forEach((id) => next.add(id));
      return next;
    });
  }

  async function confirmBulkDelete() {
    const ids = [...selected];
    if (ids.length === 0) return;
    setBulkDeleting(true);
    setMessage('');
    try {
      const result = await apiFetch<{ deleted: number; missing: number }>(`/equipment/bulk-delete${boardQuery}`, {
        method: 'POST',
        body: JSON.stringify({ ids }),
      });
      const idSet = new Set(ids);
      setRows((current) => current.filter((row) => !(row.saved && idSet.has(row.saved.id))));
      setSelected(new Set());
      const missingNote = result.missing > 0 ? ` (${result.missing}줄은 이미 다른 사람이 지웠습니다)` : '';
      setMessage(`${result.deleted}줄을 삭제했습니다.${missingNote} 지운 값은 변경 이력에서 볼 수 있습니다.`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBulkConfirmOpen(false);
      setBulkDeleting(false);
    }
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

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>, row: Row) {
    // Enter 는 저장, Shift+Enter 는 칸 안에서 줄바꿈 (비고처럼 여러 줄인 값).
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
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
    a.download = `장비현황_${board?.name ?? ''}_${toISODate(new Date())}.csv`;
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
        await apiFetch(`/equipment/columns${boardQuery}`, { method: 'POST', body: JSON.stringify({ label }) });
      }
      const nextColumns = await apiFetch<EquipmentColumn[]>(`/equipment/columns${boardQuery}`);
      const parsed = fromCsv(pendingImport.lines, nextColumns);
      // 서버는 한 번에 500줄까지 받으므로 나눠 보낸다.
      let createdCount = 0;
      for (let start = 0; start < parsed.length; start += BULK_LIMIT) {
        const chunk = parsed.slice(start, start + BULK_LIMIT);
        const created = await apiFetch<Equipment[]>(`/equipment/bulk${boardQuery}`, {
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
            이 장비 현황을 볼 수 있는 사람은 누구나 고칠 수 있습니다. 칸을 고친 뒤 Enter 나 저장을 누르면 그 줄만 저장되고, 변경 이력에 남습니다. 칸 안에서 줄을 바꾸려면 Shift+Enter 를 누릅니다.
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

      {/* B-112: 장비 그룹. 내가 참여한 프로젝트에 연결된 그룹만 나온다. */}
      <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-white px-3 py-2.5">
        <span className="text-tiny font-bold text-text-subtle">장비 그룹</span>
        {boards.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => switchBoard(item.id)}
            title={
              item.major_projects.length > 0
                ? `연결된 대프로젝트: ${item.major_projects.map((major) => major.name).join(', ')}`
                : '모든 사람이 보는 장비 현황'
            }
            className={`rounded-full px-3 py-1.5 text-small font-semibold ${
              item.id === boardId
                ? 'bg-brand text-white'
                : 'border border-border bg-white text-text-muted hover:bg-surface-muted'
            }`}
          >
            {item.name}
          </button>
        ))}
        {isAdmin && (
          <button
            type="button"
            onClick={() => setBoardsOpen(true)}
            title="같은 장비를 쓰는 대프로젝트를 묶어 그룹을 만들거나 고칩니다."
            className="ml-auto rounded-full border border-brand-soft bg-white px-3 py-1.5 text-small font-bold text-brand hover:bg-brand-soft"
          >
            그룹 관리
          </button>
        )}
        {board && (
          <p className="w-full text-tiny text-text-subtle">
            {board.major_projects.length > 0
              ? `연결된 대프로젝트: ${board.major_projects.map((major) => major.name).join(', ')} · 이 프로젝트에 참여한 사람만 봅니다.`
              : '연결된 대프로젝트가 없어 모든 사람이 봅니다.'}
          </p>
        )}
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

      {selected.size > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-surface-muted px-3 py-2 text-small">
          <span className="font-semibold text-text">{selected.size}줄 선택됨</span>
          <button
            type="button"
            onClick={() => setBulkConfirmOpen(true)}
            className="rounded-full border border-border bg-white px-3 py-1 text-tiny font-bold text-verify-fail-fg hover:bg-verify-fail-bg"
          >
            선택 삭제
          </button>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="rounded-full border border-border bg-white px-3 py-1 text-tiny text-text-muted hover:bg-surface-muted"
          >
            선택 해제
          </button>
        </div>
      )}

      {dirtyCount > 0 && (
        <p className="mt-3 text-small font-semibold text-verify-warn-fg">
          저장하지 않은 줄 {dirtyCount}개 (노란 줄). 저장하지 않고 나가면 사라집니다.
        </p>
      )}

      {/* B-109: 서식 도구. 버튼을 눌러도 칸의 커서가 빠지지 않게 mousedown 을 막는다. */}
      <div
        className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-border bg-white px-3 py-2 text-tiny text-text-muted"
        onMouseDown={(event) => {
          if ((event.target as HTMLElement).tagName !== 'INPUT') event.preventDefault();
        }}
      >
        <span className="font-bold text-text-subtle">서식</span>
        <button
          type="button"
          disabled={!activeCell}
          onClick={() => applyFormat({ bold: !activeFormat.bold })}
          aria-pressed={!!activeFormat.bold}
          title="굵게"
          className={`h-7 w-7 rounded-md border text-small font-bold disabled:opacity-40 ${
            activeFormat.bold ? 'border-brand bg-brand-soft text-brand' : 'border-border bg-white text-text'
          }`}
        >
          B
        </button>
        <span className="flex items-center gap-1">
          칸 색
          <button
            type="button"
            disabled={!activeCell}
            onClick={() => applyFormat({ bg: null })}
            title="칸 색 없음"
            className="h-6 w-6 rounded border border-border bg-white text-text-subtle disabled:opacity-40"
          >
            ×
          </button>
          {FILL_COLORS.map((color) => (
            <button
              key={color.value}
              type="button"
              disabled={!activeCell}
              onClick={() => applyFormat({ bg: color.value })}
              title={`칸 색: ${color.label}`}
              aria-label={`칸 색 ${color.label}`}
              style={{ backgroundColor: color.value }}
              className={`h-6 w-6 rounded border disabled:opacity-40 ${
                activeFormat.bg === color.value ? 'border-brand ring-2 ring-brand/40' : 'border-border'
              }`}
            />
          ))}
        </span>
        <span className="flex items-center gap-1">
          글자 색
          <button
            type="button"
            disabled={!activeCell}
            onClick={() => applyFormat({ fg: null })}
            title="글자 색 기본"
            className="h-6 w-6 rounded border border-border bg-white font-bold text-text disabled:opacity-40"
          >
            A
          </button>
          {TEXT_COLORS.map((color) => (
            <button
              key={color.value}
              type="button"
              disabled={!activeCell}
              onClick={() => applyFormat({ fg: color.value })}
              title={`글자 색: ${color.label}`}
              aria-label={`글자 색 ${color.label}`}
              style={{ color: color.value }}
              className={`h-6 w-6 rounded border bg-white font-bold disabled:opacity-40 ${
                activeFormat.fg === color.value ? 'border-brand ring-2 ring-brand/40' : 'border-border'
              }`}
            >
              A
            </button>
          ))}
        </span>
        <label className="flex cursor-pointer items-center gap-1">
          <input
            type="checkbox"
            checked={formatWholeRow}
            onChange={(event) => setFormatWholeRow(event.target.checked)}
          />
          줄 전체에 적용
        </label>
        <button
          type="button"
          disabled={!activeCell}
          onClick={() => applyFormat('clear')}
          className="rounded-full border border-border bg-white px-2.5 py-1 font-semibold disabled:opacity-40"
        >
          서식 지우기
        </button>
        <span className="text-text-subtle">
          {activeCell
            ? '고른 칸에 적용됩니다. 저장을 눌러야 모두에게 보입니다.'
            : '칸을 누른 뒤 서식을 고르세요. 열 너비는 머리글 오른쪽 끝을 끌어 바꿉니다(두 번 누르면 기본 너비).'}
        </span>
      </div>

      {/* 열이 많아 옆으로 길다. 머리글은 위에, 첫 열(장비 이름)은 왼쪽에 고정한다. */}
      <div className="mt-3 max-h-[70vh] overflow-auto rounded-2xl border border-border bg-white">
        <table className="min-w-max border-collapse text-small">
          <thead className="sticky top-0 z-30 bg-surface-muted text-left text-tiny font-bold text-text-muted">
            <tr>
              <th className="sticky left-0 z-20 w-10 min-w-10 border-b border-border bg-surface-muted px-2 py-2">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = !allVisibleSelected && someVisibleSelected;
                  }}
                  onChange={toggleAllVisible}
                  disabled={selectableIds.length === 0}
                  aria-label="보이는 장비 모두 선택"
                />
              </th>
              {columns.map((column, index) => (
                <th
                  key={column.id}
                  style={columnStyle(column)}
                  className={`min-w-[7rem] border-b border-border px-2 py-2 ${
                    index === 0 ? 'sticky left-10 z-20 border-r bg-surface-muted' : 'relative'
                  }`}
                >
                  <span className="block truncate pr-1">{column.label}</span>
                  <span
                    role="separator"
                    aria-label={`${column.label} 열 너비 조절`}
                    title="끌어서 열 너비 조절 · 두 번 누르면 기본 너비"
                    onMouseDown={(event) => startResize(event, column)}
                    onDoubleClick={() => void saveWidth(column, null)}
                    className={`absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-brand/50 ${
                      dragWidth?.columnId === column.id ? 'bg-brand' : ''
                    }`}
                  />
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
                  <td
                    className={`sticky left-0 z-10 w-10 min-w-10 px-2 py-2.5 ${dirty ? 'bg-verify-warn-bg' : 'bg-white'}`}
                  >
                    {row.saved && !row.gone && (
                      <input
                        type="checkbox"
                        checked={selected.has(row.saved.id)}
                        onChange={() => toggleSelected(row.saved!.id)}
                        aria-label={`${rowName(row)} 선택`}
                      />
                    )}
                  </td>
                  {columns.map((column, index) => (
                    <td
                      key={column.id}
                      style={{
                        ...columnStyle(column),
                        ...(row.formats[column.id]?.bg
                          ? { backgroundColor: row.formats[column.id].bg }
                          : {}),
                      }}
                      className={`min-w-[7rem] p-0 ${
                        index === 0
                          ? `sticky left-10 z-10 border-r border-border ${dirty ? 'bg-verify-warn-bg' : 'bg-white'}`
                          : ''
                      } ${
                        activeCell?.rowKey === row.key && activeCell.columnId === column.id
                          ? 'outline outline-2 -outline-offset-2 outline-brand/60'
                          : ''
                      }`}
                    >
                      {/* 한 줄 입력칸이면 여러 줄 값의 줄바꿈이 보이지 않아, 줄 수만큼 높아지는 칸을 쓴다. */}
                      <textarea
                        value={row.draft[column.id] ?? ''}
                        title={row.draft[column.id] || undefined}
                        rows={Math.min(6, (row.draft[column.id] ?? '').split('\n').length)}
                        onChange={(event) => setCell(row.key, column.id, event.target.value)}
                        onKeyDown={(event) => handleKeyDown(event, row)}
                        onFocus={() => setActiveCell({ rowKey: row.key, columnId: column.id })}
                        aria-label={column.label}
                        style={{
                          color: row.formats[column.id]?.fg,
                          fontWeight: row.formats[column.id]?.bold ? 700 : undefined,
                        }}
                        className="block w-full resize-none bg-transparent px-2 py-2 text-small leading-5 text-text outline-none"
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
        open={bulkConfirmOpen}
        title="선택한 장비 삭제"
        description={`선택한 ${selected.size}줄을 삭제합니다. 모든 팀원의 표에서 사라지며, 지운 값은 변경 이력에서 줄마다 확인할 수 있습니다. 고치던 내용이 있는 줄은 그 내용도 사라집니다.`}
        confirmLabel={`${selected.size}줄 삭제`}
        variant="danger"
        busy={bulkDeleting}
        onConfirm={() => void confirmBulkDelete()}
        onClose={() => setBulkConfirmOpen(false)}
      />

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

      {boardId !== null && (
        <>
          <ColumnManager
            open={columnsOpen}
            boardId={boardId}
            columns={columns}
            onClose={() => setColumnsOpen(false)}
            onChanged={() => load(true)}
          />
          <HistoryModal open={historyOpen} boardId={boardId} onClose={() => setHistoryOpen(false)} />
          <HistoryModal
            open={historyRow !== null}
            boardId={boardId}
            equipmentId={historyRow?.saved?.id}
            title={historyRow ? `${rowName(historyRow)} 변경 이력` : undefined}
            onClose={() => setHistoryRow(null)}
          />
        </>
      )}
      <BoardManager
        open={boardsOpen}
        boards={boards}
        onClose={() => setBoardsOpen(false)}
        onChanged={async (focusBoardId) => {
          if (focusBoardId !== undefined && focusBoardId !== boardId) {
            // 새로 만든 그룹으로 옮긴다 (고치던 줄이 있으면 그대로 둔다).
            if (dirtyCount === 0) {
              storeBoardId(focusBoardId);
              setRows([]);
              setColumns([]);
              setLoaded(false);
              setSelected(new Set());
              setActiveCell(null);
              await loadBoards(focusBoardId);
              return;
            }
          }
          await loadBoards();
        }}
      />
    </AppShell>
  );
}
