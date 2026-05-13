'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  apiFetch,
  PROJECT_TYPE_LABEL,
  type Project,
  type ProjectHistoryCreate,
  type ProjectHistoryEntry,
  type ProjectHistoryUpdate,
  type SubProject,
} from '../../lib/api';

type AdminUser = {
  id: number;
  name: string;
  center?: string | null;
  office?: string | null;
  team?: string | null;
  position?: string | null;
};

type Props = {
  enabled: boolean;
  users: AdminUser[];
  selectedUserIds?: Set<number> | null;
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

type CreateDraft = {
  user_id: number | '';
  project_id: number | '';
  project_name: string;
  project_type: string;
  subproject_id: number | '';
  subproject_name: string;
  started_on: string;
  ended_on: string;
  worked_minutes: string;
  keyword_text: string;
};

const DEFAULT_RANGE: DateRange = { from: '', to: '' };
const DEFAULT_CREATE_DRAFT: CreateDraft = {
  user_id: '',
  project_id: '',
  project_name: '',
  project_type: 'manual',
  subproject_id: '',
  subproject_name: '',
  started_on: '',
  ended_on: '',
  worked_minutes: '0',
  keyword_text: '',
};

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

export default function WorkHistoryManager({
  enabled,
  users,
  selectedUserIds = null,
}: Props) {
  const [entries, setEntries] = useState<ProjectHistoryEntry[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [subprojects, setSubprojects] = useState<SubProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [projectId, setProjectId] = useState<number | ''>('');
  const [range, setRange] = useState<DateRange>(DEFAULT_RANGE);
  const [createDraft, setCreateDraft] = useState<CreateDraft>(DEFAULT_CREATE_DRAFT);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [showSampleRows, setShowSampleRows] = useState(false);

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
      if (projectId !== '') params.set('project_id', String(projectId));
      const qs = params.toString();
      const [historyRows, projectRows, subprojectRows] = await Promise.all([
        apiFetch<ProjectHistoryEntry[]>(
          `/projects/history${qs ? `?${qs}` : ''}`,
        ),
        projects.length === 0
          ? apiFetch<Project[]>('/projects')
          : Promise.resolve(projects),
        subprojects.length === 0
          ? apiFetch<SubProject[]>('/subprojects')
          : Promise.resolve(subprojects),
      ]);
      setEntries(historyRows);
      if (projects.length === 0) setProjects(projectRows);
      if (subprojects.length === 0) setSubprojects(subprojectRows);
      setMessage('');
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    let rows = entries;
    if (selectedUserIds) {
      rows = rows.filter((row) => selectedUserIds.has(row.user_id));
    }
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
  }, [entries, range.from, range.to, selectedUserIds]);

  const sampleEntries = useMemo<ProjectHistoryEntry[]>(
    () =>
      (selectedUserIds
        ? users.filter((user) => selectedUserIds.has(user.id))
        : users
      ).slice(0, 5).map((user, index) => ({
        id: -(index + 1),
        user_id: user.id,
        user_name: user.name,
        project_id: null,
        project_name: ['과거 IVI 검증', 'HPC 통합 점검', 'OTA 회귀 검증', '진단 통신 평가', '제어기 릴리즈 지원'][index % 5],
        subproject_id: null,
        subproject_name: ['요구사항 분석', '환경 구성', '시나리오 검증', '결과 리뷰', '이슈 재현'][index % 5],
        project_type: 'manual',
        role_in_project: 'assignee',
        started_on: `2026-0${Math.min(index + 1, 5)}-03`,
        ended_on: `2026-0${Math.min(index + 1, 5)}-07`,
        worked_minutes: 360 + index * 75,
        completion_rate: 100,
        recorded_at: new Date().toISOString(),
        manual_override: true,
      })),
    [selectedUserIds, users],
  );
  const displayRows = showSampleRows ? sampleEntries : filtered;
  const displayTotalMinutes = useMemo(
    () => displayRows.reduce((sum, row) => sum + (row.worked_minutes || 0), 0),
    [displayRows],
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
  const createSubprojectOptions = useMemo(
    () =>
      subprojects
        .filter((sp) =>
          createDraft.project_id === ''
            ? true
            : sp.project_id === createDraft.project_id,
        )
        .sort((a, b) => a.name.localeCompare(b.name, 'ko-KR')),
    [createDraft.project_id, subprojects],
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

  function updateCreateDraft<K extends keyof CreateDraft>(
    key: K,
    value: CreateDraft[K],
  ) {
    setCreateDraft((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'project_id') {
        next.subproject_id = '';
        const selectedProject = projects.find((project) => project.id === value);
        next.project_name = selectedProject?.name ?? '';
        next.project_type = selectedProject?.project_type ? String(selectedProject.project_type) : 'manual';
        next.subproject_name = '';
        next.started_on = '';
        next.ended_on = '';
      }
      if (key === 'subproject_id' && typeof value === 'number') {
        const selected = subprojects.find((sp) => sp.id === value);
        if (selected) {
          next.project_id = selected.project_id;
          const selectedProject = projects.find((project) => project.id === selected.project_id);
          next.project_name = selectedProject?.name ?? '';
          next.project_type = selectedProject?.project_type ? String(selectedProject.project_type) : 'manual';
          next.subproject_name = selected.name;
          next.started_on = selected.start_date;
          next.ended_on = selected.end_date;
        }
      }
      return next;
    });
  }

  async function createManualHistory() {
    if (
      createDraft.user_id === '' ||
      !createDraft.project_name.trim() ||
      !createDraft.subproject_name.trim()
    ) {
      setCreateError('담당자, 프로젝트명, 하위 프로젝트명을 확인해주세요.');
      return;
    }
    const minutes = Number(createDraft.worked_minutes);
    if (!Number.isFinite(minutes) || minutes < 0) {
      setCreateError('소요 시간은 0 이상의 숫자로 입력해주세요.');
      return;
    }

    setCreating(true);
    setCreateError('');
    try {
      const payload: ProjectHistoryCreate = {
        user_id: createDraft.user_id,
        project_id: createDraft.project_id === '' ? null : createDraft.project_id,
        project_name: createDraft.project_name.trim(),
        project_type: createDraft.project_type,
        subproject_id: createDraft.subproject_id === '' ? null : createDraft.subproject_id,
        subproject_name: createDraft.subproject_name.trim(),
        started_on: createDraft.started_on || null,
        ended_on: createDraft.ended_on || null,
        worked_minutes: minutes,
        completion_rate: 100,
        keyword_text: createDraft.keyword_text.trim() || null,
      };
      await apiFetch<ProjectHistoryEntry>('/projects/history', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setCreateDraft(DEFAULT_CREATE_DRAFT);
      await load();
      setMessage('업무 이력을 추가했습니다.');
    } catch (error) {
      setCreateError((error as Error).message);
    } finally {
      setCreating(false);
    }
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
      <section className="rounded-2xl border border-[#EAEAE4] bg-white p-4">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-[14px] font-bold text-[#1A1A1A]">
              업무 이력 추가
            </h3>
            <p className="mt-1 text-[12px] text-[#888780]">
              담당자별 수행 업무와 기간, 소요 시간을 직접 기록합니다.
            </p>
          </div>
          {createError && (
            <p className="text-[12px] font-semibold text-[#A32D2D]">
              {createError}
            </p>
          )}
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <div>
            <label className="block text-[12px] font-semibold text-[#888780]">
              담당자
            </label>
            <select
              className="mt-1 w-full rounded-lg border border-[#EAEAE4] bg-white px-3 py-2 text-[13px] text-[#1A1A1A]"
              value={createDraft.user_id}
              onChange={(e) =>
                updateCreateDraft(
                  'user_id',
                  e.target.value === '' ? '' : Number(e.target.value),
                )
              }
            >
              <option value="">선택</option>
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
              value={createDraft.project_id}
              onChange={(e) =>
                updateCreateDraft(
                  'project_id',
                  e.target.value === '' ? '' : Number(e.target.value),
                )
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
              프로젝트명
            </label>
            <input
              type="text"
              className="mt-1 w-full rounded-lg border border-[#EAEAE4] bg-white px-3 py-2 text-[13px] text-[#1A1A1A]"
              value={createDraft.project_name}
              onChange={(e) =>
                setCreateDraft((prev) => ({
                  ...prev,
                  project_id: '',
                  subproject_id: '',
                  project_name: e.target.value,
                  project_type: 'manual',
                }))
              }
              placeholder="목록에 없으면 직접 입력"
            />
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-[#888780]">
              하위 프로젝트
            </label>
            <select
              className="mt-1 w-full rounded-lg border border-[#EAEAE4] bg-white px-3 py-2 text-[13px] text-[#1A1A1A]"
              value={createDraft.subproject_id}
              onChange={(e) =>
                updateCreateDraft(
                  'subproject_id',
                  e.target.value === '' ? '' : Number(e.target.value),
                )
              }
            >
              <option value="">선택</option>
              {createSubprojectOptions.map((sp) => (
                <option key={sp.id} value={sp.id}>
                  {sp.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-[#888780]">
              하위 프로젝트명
            </label>
            <input
              type="text"
              className="mt-1 w-full rounded-lg border border-[#EAEAE4] bg-white px-3 py-2 text-[13px] text-[#1A1A1A]"
              value={createDraft.subproject_name}
              onChange={(e) =>
                updateCreateDraft('subproject_name', e.target.value)
              }
            />
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-[#888780]">
              시작일
            </label>
            <input
              type="date"
              className="mt-1 w-full rounded-lg border border-[#EAEAE4] bg-white px-3 py-2 text-[13px] text-[#1A1A1A]"
              value={createDraft.started_on}
              onChange={(e) =>
                updateCreateDraft('started_on', e.target.value)
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
              value={createDraft.ended_on}
              onChange={(e) => updateCreateDraft('ended_on', e.target.value)}
            />
          </div>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-[160px_1fr_auto]">
          <div>
            <label className="block text-[12px] font-semibold text-[#888780]">
              소요 시간(분)
            </label>
            <input
              type="number"
              min={0}
              className="mt-1 w-full rounded-lg border border-[#EAEAE4] bg-white px-3 py-2 text-[13px] text-[#1A1A1A]"
              value={createDraft.worked_minutes}
              onChange={(e) =>
                updateCreateDraft('worked_minutes', e.target.value)
              }
            />
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-[#888780]">
              업무 메모
            </label>
            <input
              type="text"
              className="mt-1 w-full rounded-lg border border-[#EAEAE4] bg-white px-3 py-2 text-[13px] text-[#1A1A1A]"
              value={createDraft.keyword_text}
              onChange={(e) =>
                updateCreateDraft('keyword_text', e.target.value)
              }
            />
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => void createManualHistory()}
              disabled={creating}
              className="w-full rounded-lg bg-[#534AB7] px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-[#3F38A0] disabled:opacity-50 md:w-auto"
            >
              {creating ? '추가 중...' : '이력 추가'}
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-[#EAEAE4] bg-white p-4">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-[14px] font-bold text-[#1A1A1A]">
              업무 이력 확인
            </h3>
            <p className="mt-1 text-[12px] text-[#888780]">
              상단에서 선택한 담당자 또는 조직 범위의 업무 이력을 확인합니다.
            </p>
          </div>
        </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
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
          총 <strong className="text-[#1A1A1A]">{displayRows.length}</strong>건 ·
          누적 소요{' '}
          <strong className="text-[#1A1A1A]">
            {formatMinutes(displayTotalMinutes)}
          </strong>
        </span>
        <button
          type="button"
          onClick={() => setShowSampleRows((prev) => !prev)}
          className="rounded-lg border border-[#EAEAE4] px-3 py-1.5 text-[12px] font-semibold text-[#534AB7]"
        >
          {showSampleRows ? '실제 이력 보기' : '샘플 이력 보기'}
        </button>
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
            {displayRows.length === 0 && !loading && (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-8 text-center text-[12px] text-[#888780]"
                >
                  표시할 업무 이력이 없습니다.
                </td>
              </tr>
            )}
            {displayRows.map((row) => (
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
                      disabled={row.id < 0}
                      className="rounded-lg border border-[#EAEAE4] px-2.5 py-1 text-[12px] font-semibold text-[#1A1A1A] transition hover:border-[#534AB7] hover:text-[#534AB7]"
                    >
                      편집
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteRow(row)}
                      disabled={deletingId === row.id || row.id < 0}
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

      </section>

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
                  하위 프로젝트명
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
