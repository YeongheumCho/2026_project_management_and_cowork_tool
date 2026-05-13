'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  apiFetch,
  PROJECT_TYPE_LABEL,
  type Project,
  type ProjectHistoryEntry,
  type ProjectHistoryUpdate,
} from '../../lib/api';

type AdminUser = {
  id: number;
  name: string;
};

type Props = {
  enabled: boolean;
  users: AdminUser[];
};

type DateRange = {
  from: string;
  to: string;
};

type EditDraft = {
  subproject_name: string;
  started_on: string;
  ended_on: string;
  worked_minutes: string;
  keyword_text: string;
};

const DEFAULT_RANGE: DateRange = { from: '', to: '' };

function formatDate(value: string | null): string {
  if (!value) return '-';
  if (value.length >= 10) return value.slice(0, 10);
  return value;
}

function formatMinutes(min: number): string {
  if (!Number.isFinite(min) || min <= 0) return '-';
  const hours = Math.floor(min / 60);
  const mins = min % 60;
  if (hours === 0) return `${mins}분`;
  if (mins === 0) return `${hours}시간`;
  return `${hours}시간 ${mins}분`;
}

function toDraft(row: ProjectHistoryEntry): EditDraft {
  return {
    subproject_name: row.subproject_name,
    started_on: row.started_on ? row.started_on.slice(0, 10) : '',
    ended_on: row.ended_on ? row.ended_on.slice(0, 10) : '',
    worked_minutes: String(row.worked_minutes ?? 0),
    keyword_text: '',
  };
}

function buildUpdatePayload(
  draft: EditDraft,
  original: ProjectHistoryEntry,
): ProjectHistoryUpdate {
  const payload: ProjectHistoryUpdate = {};
  if (draft.subproject_name.trim() !== original.subproject_name) {
    payload.subproject_name = draft.subproject_name.trim();
  }
  const origStart = original.started_on ? original.started_on.slice(0, 10) : '';
  const origEnd = original.ended_on ? original.ended_on.slice(0, 10) : '';
  if (draft.started_on !== origStart) {
    payload.started_on = draft.started_on || null;
  }
  if (draft.ended_on !== origEnd) {
    payload.ended_on = draft.ended_on || null;
  }
  const minutesNum = Number(draft.worked_minutes);
  if (Number.isFinite(minutesNum) && minutesNum !== original.worked_minutes) {
    payload.worked_minutes = minutesNum;
  }
  if (draft.keyword_text.trim() !== '') {
    payload.keyword_text = draft.keyword_text.trim();
  }
  return payload;
}

export default function WorkHistoryManager({ enabled, users }: Props) {
  const [entries, setEntries] = useState<ProjectHistoryEntry[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [userId, setUserId] = useState<number | ''>('');
  const [projectId, setProjectId] = useState<number | ''>('');
  const [range, setRange] = useState<DateRange>(DEFAULT_RANGE);

  const [editingRow, setEditingRow] = useState<ProjectHistoryEntry | null>(null);
  const [draft, setDraft] = useState<EditDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (userId !== '') params.set('user_id', String(userId));
      if (projectId !== '') params.set('project_id', String(projectId));
      const qs = params.toString();
      const [historyRows, projectRows] = await Promise.all([
        apiFetch<ProjectHistoryEntry[]>(
          `/projects/history${qs ? `?${qs}` : ''}`,
        ),
        projects.length === 0
          ? apiFetch<Project[]>('/projects')
          : Promise.resolve(projects),
      ]);
      setEntries(historyRows);
      if (projects.length === 0) setProjects(projectRows);
      setMessage('');
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, userId, projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    let rows = entries;
    if (range.from) {
      rows = rows.filter(
        (row) => row.ended_on !== null && row.ended_on >= range.from,
      );
    }
    if (range.to) {
      rows = rows.filter(
        (row) => row.ended_on !== null && row.ended_on <= range.to,
      );
    }
    return rows;
  }, [entries, range.from, range.to]);

  const totalMinutes = useMemo(
    () => filtered.reduce((sum, row) => sum + (row.worked_minutes || 0), 0),
    [filtered],
  );

  const sortedUsers = useMemo(
    () => [...users].sort((a, b) => a.name.localeCompare(b.name, 'ko-KR')),
    [users],
  );
  const sortedProjects = useMemo(
    () =>
      [...projects].sort((a, b) =>
        a.name.localeCompare(b.name, 'ko-KR'),
      ),
    [projects],
  );

  function openEdit(row: ProjectHistoryEntry) {
    setEditingRow(row);
    setDraft(toDraft(row));
    setEditError('');
  }

  function closeEdit() {
    setEditingRow(null);
    setDraft(null);
    setEditError('');
  }

  async function saveEdit() {
    if (!editingRow || !draft) return;
    const payload = buildUpdatePayload(draft, editingRow);
    if (Object.keys(payload).length === 0) {
      closeEdit();
      return;
    }
    setSaving(true);
    setEditError('');
    try {
      const updated = await apiFetch<ProjectHistoryEntry>(
        `/projects/history/${editingRow.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify(payload),
        },
      );
      setEntries((prev) =>
        prev.map((row) => (row.id === updated.id ? updated : row)),
      );
      closeEdit();
    } catch (error) {
      setEditError((error as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteRow(row: ProjectHistoryEntry) {
    if (
      !window.confirm(
        `${row.user_name}님의 "${row.subproject_name}" 이력을 삭제할까요?`,
      )
    ) {
      return;
    }
    setDeletingId(row.id);
    setMessage('');
    try {
      await apiFetch<void>(`/projects/history/${row.id}`, {
        method: 'DELETE',
      });
      setEntries((prev) => prev.filter((item) => item.id !== row.id));
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setDeletingId(null);
    }
  }

  if (!enabled) {
    return (
      <div className="rounded-2xl border border-[#F4D6D6] bg-[#FFF7F7] p-6 text-sm text-[#A32D2D]">
        관리자만 사용할 수 있습니다.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 rounded-2xl border border-[#EAEAE4] bg-white p-4 md:grid-cols-4">
        <div>
          <label className="block text-[12px] font-semibold text-[#888780]">
            담당자
          </label>
          <select
            className="mt-1 w-full rounded-lg border border-[#EAEAE4] bg-white px-3 py-2 text-[13px] text-[#1A1A1A]"
            value={userId}
            onChange={(e) =>
              setUserId(e.target.value === '' ? '' : Number(e.target.value))
            }
          >
            <option value="">전체</option>
            {sortedUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[12px] font-semibold text-[#888780]">
            프로젝트
          </label>
          <select
            className="mt-1 w-full rounded-lg border border-[#EAEAE4] bg-white px-3 py-2 text-[13px] text-[#1A1A1A]"
            value={projectId}
            onChange={(e) =>
              setProjectId(e.target.value === '' ? '' : Number(e.target.value))
            }
          >
            <option value="">전체</option>
            {sortedProjects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[12px] font-semibold text-[#888780]">
            완료일 시작
          </label>
          <input
            type="date"
            className="mt-1 w-full rounded-lg border border-[#EAEAE4] bg-white px-3 py-2 text-[13px] text-[#1A1A1A]"
            value={range.from}
            onChange={(e) =>
              setRange((r) => ({ ...r, from: e.target.value }))
            }
          />
        </div>
        <div>
          <label className="block text-[12px] font-semibold text-[#888780]">
            완료일 종료
          </label>
          <input
            type="date"
            className="mt-1 w-full rounded-lg border border-[#EAEAE4] bg-white px-3 py-2 text-[13px] text-[#1A1A1A]"
            value={range.to}
            onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
          />
        </div>
      </div>

      <div className="flex items-center justify-between text-[12px] text-[#888780]">
        <span>
          총 <strong className="text-[#1A1A1A]">{filtered.length}</strong>건 ·
          누적 소요{' '}
          <strong className="text-[#1A1A1A]">
            {formatMinutes(totalMinutes)}
          </strong>
        </span>
        {message && <span className="text-[#A32D2D]">{message}</span>}
        {loading && <span>불러오는 중...</span>}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-[#EAEAE4] bg-white">
        <table className="w-full text-[13px]">
          <thead className="bg-[#FAFAFA] text-left text-[12px] text-[#888780]">
            <tr>
              <th className="px-4 py-3 font-semibold">담당자</th>
              <th className="px-4 py-3 font-semibold">프로젝트</th>
              <th className="px-4 py-3 font-semibold">소프로젝트</th>
              <th className="px-4 py-3 font-semibold">유형</th>
              <th className="px-4 py-3 font-semibold">시작일</th>
              <th className="px-4 py-3 font-semibold">종료일</th>
              <th className="px-4 py-3 font-semibold">소요</th>
              <th className="px-4 py-3 font-semibold text-right">작업</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && !loading && (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-8 text-center text-[12px] text-[#888780]"
                >
                  표시할 업무 이력이 없습니다.
                </td>
              </tr>
            )}
            {filtered.map((row) => (
              <tr
                key={row.id}
                className="border-t border-[#EAEAE4] text-[#1A1A1A]"
              >
                <td className="px-4 py-3">{row.user_name}</td>
                <td className="px-4 py-3">{row.project_name}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span>{row.subproject_name}</span>
                    {row.manual_override && (
                      <span className="rounded-full bg-[#F1EEFB] px-2 py-0.5 text-[10px] font-semibold text-[#534AB7]">
                        수동
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-[#534AB7]">
                  {PROJECT_TYPE_LABEL[row.project_type] ?? row.project_type}
                </td>
                <td className="px-4 py-3">{formatDate(row.started_on)}</td>
                <td className="px-4 py-3">{formatDate(row.ended_on)}</td>
                <td className="px-4 py-3">{formatMinutes(row.worked_minutes)}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => openEdit(row)}
                      className="rounded-lg border border-[#EAEAE4] px-2.5 py-1 text-[12px] font-semibold text-[#1A1A1A] transition hover:border-[#534AB7] hover:text-[#534AB7]"
                    >
                      편집
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteRow(row)}
                      disabled={deletingId === row.id}
                      className="rounded-lg border border-[#F4D6D6] px-2.5 py-1 text-[12px] font-semibold text-[#A32D2D] transition hover:bg-[#FFF7F7] disabled:opacity-50"
                    >
                      {deletingId === row.id ? '삭제 중...' : '삭제'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[12px] text-[#888780]">
        업무 이력은 소프로젝트 완료 시 자동으로 기록됩니다. 관리자가 편집한 행은
        <span className="mx-1 rounded-full bg-[#F1EEFB] px-2 py-0.5 text-[10px] font-semibold text-[#534AB7]">
          수동
        </span>
        뱃지가 붙으며 이후 자동 동기화로 덮어쓰이지 않습니다.
      </p>

      {editingRow && draft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-[15px] font-bold text-[#1A1A1A]">
              업무 이력 편집
            </h3>
            <p className="mt-1 text-[12px] text-[#888780]">
              {editingRow.user_name} · {editingRow.project_name}
            </p>

            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-[12px] font-semibold text-[#888780]">
                  업무 이름
                </label>
                <input
                  type="text"
                  className="mt-1 w-full rounded-lg border border-[#EAEAE4] bg-white px-3 py-2 text-[13px] text-[#1A1A1A]"
                  value={draft.subproject_name}
                  onChange={(e) =>
                    setDraft((d) =>
                      d ? { ...d, subproject_name: e.target.value } : d,
                    )
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-semibold text-[#888780]">
                    시작일
                  </label>
                  <input
                    type="date"
                    className="mt-1 w-full rounded-lg border border-[#EAEAE4] bg-white px-3 py-2 text-[13px] text-[#1A1A1A]"
                    value={draft.started_on}
                    onChange={(e) =>
                      setDraft((d) =>
                        d ? { ...d, started_on: e.target.value } : d,
                      )
                    }
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-[#888780]">
                    종료일
                  </label>
                  <input
                    type="date"
                    className="mt-1 w-full rounded-lg border border-[#EAEAE4] bg-white px-3 py-2 text-[13px] text-[#1A1A1A]"
                    value={draft.ended_on}
                    onChange={(e) =>
                      setDraft((d) =>
                        d ? { ...d, ended_on: e.target.value } : d,
                      )
                    }
                  />
                </div>
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-[#888780]">
                  소요 시간 (분)
                </label>
                <input
                  type="number"
                  min={0}
                  className="mt-1 w-full rounded-lg border border-[#EAEAE4] bg-white px-3 py-2 text-[13px] text-[#1A1A1A]"
                  value={draft.worked_minutes}
                  onChange={(e) =>
                    setDraft((d) =>
                      d ? { ...d, worked_minutes: e.target.value } : d,
                    )
                  }
                />
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-[#888780]">
                  비고/메모{' '}
                  <span className="text-[#BBB]">
                    (선택, 입력 시 keyword_text 갱신)
                  </span>
                </label>
                <textarea
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-[#EAEAE4] bg-white px-3 py-2 text-[13px] text-[#1A1A1A]"
                  value={draft.keyword_text}
                  onChange={(e) =>
                    setDraft((d) =>
                      d ? { ...d, keyword_text: e.target.value } : d,
                    )
                  }
                />
              </div>
            </div>

            {editError && (
              <p className="mt-3 text-[12px] text-[#A32D2D]">{editError}</p>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeEdit}
                disabled={saving}
                className="rounded-lg border border-[#EAEAE4] px-3 py-2 text-[13px] font-semibold text-[#1A1A1A] transition hover:border-[#888780] disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => void saveEdit()}
                disabled={saving}
                className="rounded-lg bg-[#534AB7] px-3 py-2 text-[13px] font-semibold text-white transition hover:bg-[#3F38A0] disabled:opacity-50"
              >
                {saving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
