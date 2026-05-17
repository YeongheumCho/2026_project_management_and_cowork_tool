'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  apiFetch,
  PROJECT_TYPE_LABEL,
  type MajorProject,
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

type DateRange = {
  from: string;
  to: string;
};

type Props = {
  enabled: boolean;
  users: AdminUser[];
  selectedUserIds?: Set<number> | null;
  dateRange: DateRange;
  majorProjects: MajorProject[];
  projects: Project[];
  majorProjectId: number | '';
  projectId: number | '';
  onChanged?: () => void;
};

type CreateMode = 'existing' | 'manual';

type EditDraft = {
  subproject_name: string;
  started_on: string;
  ended_on: string;
  worked_minutes: string;
  keyword_text: string;
};

type CreateDraft = {
  user_id: number | '';
  mode: CreateMode;
  major_project_id: number | '';
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

const DEFAULT_CREATE_DRAFT: CreateDraft = {
  user_id: '',
  mode: 'existing',
  major_project_id: '',
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
  return value.length >= 10 ? value.slice(0, 10) : value;
}

function formatMinutes(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return '-';
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hours === 0) return `${mins}분`;
  if (mins === 0) return `${hours}시간`;
  return `${hours}시간 ${mins}분`;
}

function escapeHtml(value: string | number | null | undefined): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function downloadExcel(filename: string, headers: string[], rows: Array<Array<string | number>>) {
  const tableRows = [
    `<tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr>`,
    ...rows.map(
      (row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`,
    ),
  ].join('');
  const html = `<!doctype html><html><head><meta charset="utf-8" /></head><body><table>${tableRows}</table></body></html>`;
  const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function projectMajorId(project: Project): number | null {
  return project.major_project_id ?? project.major_project?.id ?? null;
}

function toEditDraft(row: ProjectHistoryEntry): EditDraft {
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
  if (draft.started_on !== (original.started_on ? original.started_on.slice(0, 10) : '')) {
    payload.started_on = draft.started_on || null;
  }
  if (draft.ended_on !== (original.ended_on ? original.ended_on.slice(0, 10) : '')) {
    payload.ended_on = draft.ended_on || null;
  }
  const minutes = Number(draft.worked_minutes);
  if (Number.isFinite(minutes) && minutes !== original.worked_minutes) {
    payload.worked_minutes = minutes;
  }
  if (draft.keyword_text.trim()) {
    payload.keyword_text = draft.keyword_text.trim();
  }
  return payload;
}

export default function WorkHistoryManager({
  enabled,
  users,
  selectedUserIds = null,
  dateRange,
  majorProjects,
  projects,
  majorProjectId,
  projectId,
  onChanged,
}: Props) {
  const [entries, setEntries] = useState<ProjectHistoryEntry[]>([]);
  const [subprojects, setSubprojects] = useState<SubProject[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [createDraft, setCreateDraft] = useState<CreateDraft>(DEFAULT_CREATE_DRAFT);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [editingRow, setEditingRow] = useState<ProjectHistoryEntry | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (majorProjectId !== '') params.set('major_project_id', String(majorProjectId));
      if (projectId !== '') params.set('project_id', String(projectId));
      if (dateRange.from) params.set('start_date', dateRange.from);
      if (dateRange.to) params.set('end_date', dateRange.to);
      const query = params.toString();
      const [historyRows, subprojectRows] = await Promise.all([
        apiFetch<ProjectHistoryEntry[]>(`/projects/history${query ? `?${query}` : ''}`),
        apiFetch<SubProject[]>('/subprojects'),
      ]);
      setEntries(historyRows);
      setSubprojects(subprojectRows);
      setMessage('');
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setLoading(false);
    }
  }, [dateRange.from, dateRange.to, enabled, majorProjectId, projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setCreateDraft((prev) => ({
      ...prev,
      major_project_id: prev.mode === 'existing' ? majorProjectId : prev.major_project_id,
      project_id: prev.mode === 'existing' ? projectId : prev.project_id,
    }));
  }, [majorProjectId, projectId]);

  const sortedUsers = useMemo(
    () => [...users].sort((a, b) => a.name.localeCompare(b.name, 'ko-KR')),
    [users],
  );

  const sortedMajorProjects = useMemo(
    () => [...majorProjects].sort((a, b) => a.name.localeCompare(b.name, 'ko-KR')),
    [majorProjects],
  );

  const createProjects = useMemo(
    () =>
      projects
        .filter(
          (project) =>
            createDraft.major_project_id === '' ||
            projectMajorId(project) === createDraft.major_project_id,
        )
        .sort((a, b) => a.name.localeCompare(b.name, 'ko-KR')),
    [createDraft.major_project_id, projects],
  );

  const createSubprojectOptions = useMemo(
    () =>
      subprojects
        .filter((subproject) =>
          createDraft.project_id === '' ? false : subproject.project_id === createDraft.project_id,
        )
        .sort((a, b) => a.name.localeCompare(b.name, 'ko-KR')),
    [createDraft.project_id, subprojects],
  );

  const displayRows = useMemo(
    () =>
      selectedUserIds
        ? entries.filter((entry) => selectedUserIds.has(entry.user_id))
        : entries,
    [entries, selectedUserIds],
  );

  const totalMinutes = useMemo(
    () => displayRows.reduce((sum, row) => sum + (row.worked_minutes || 0), 0),
    [displayRows],
  );

  function updateCreateDraft<K extends keyof CreateDraft>(key: K, value: CreateDraft[K]) {
    setCreateDraft((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'mode') {
        next.project_id = value === 'existing' ? projectId : '';
        next.major_project_id = value === 'existing' ? majorProjectId : '';
        next.project_name = '';
        next.project_type = 'manual';
        next.subproject_id = '';
        next.subproject_name = '';
        next.started_on = '';
        next.ended_on = '';
      }
      if (key === 'major_project_id') {
        next.project_id = '';
        next.project_name = '';
        next.project_type = 'manual';
        next.subproject_id = '';
        next.subproject_name = '';
        next.started_on = '';
        next.ended_on = '';
      }
      if (key === 'project_id') {
        next.subproject_id = '';
        next.subproject_name = '';
        next.started_on = '';
        next.ended_on = '';
        const project = projects.find((item) => item.id === value);
        next.project_name = project?.name ?? '';
        next.project_type = project?.project_type ? String(project.project_type) : 'manual';
        next.major_project_id = project ? projectMajorId(project) ?? '' : next.major_project_id;
      }
      if (key === 'subproject_id' && typeof value === 'number') {
        const subproject = subprojects.find((item) => item.id === value);
        if (subproject) {
          const project = projects.find((item) => item.id === subproject.project_id);
          next.project_id = subproject.project_id;
          next.project_name = project?.name ?? '';
          next.project_type = project?.project_type ? String(project.project_type) : 'manual';
          next.major_project_id = project ? projectMajorId(project) ?? '' : next.major_project_id;
          next.subproject_name = subproject.name;
          next.started_on = subproject.start_date;
          next.ended_on = subproject.end_date;
        }
      }
      return next;
    });
  }

  async function createManualHistory() {
    if (createDraft.user_id === '') {
      setCreateError('담당자를 선택해 주세요.');
      return;
    }
    if (createDraft.mode === 'existing' && createDraft.subproject_id === '') {
      setCreateError('등록된 이력으로 추가하려면 프로젝트와 하위 프로젝트를 선택해 주세요.');
      return;
    }
    if (
      createDraft.mode === 'manual' &&
      (!createDraft.project_name.trim() || !createDraft.subproject_name.trim())
    ) {
      setCreateError('직접 입력 이력은 프로젝트명과 하위 프로젝트명을 입력해 주세요.');
      return;
    }
    const minutes = Number(createDraft.worked_minutes);
    if (!Number.isFinite(minutes) || minutes < 0) {
      setCreateError('소요 시간은 0 이상 숫자로 입력해 주세요.');
      return;
    }

    setCreating(true);
    setCreateError('');
    try {
      const payload: ProjectHistoryCreate = {
        user_id: createDraft.user_id,
        project_id:
          createDraft.mode === 'manual' || createDraft.project_id === ''
            ? null
            : createDraft.project_id,
        project_name: createDraft.project_name.trim(),
        project_type: createDraft.project_type,
        subproject_id:
          createDraft.mode === 'manual' || createDraft.subproject_id === ''
            ? null
            : createDraft.subproject_id,
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
      setCreateDraft({
        ...DEFAULT_CREATE_DRAFT,
        major_project_id: majorProjectId,
        project_id: projectId,
      });
      setShowCreateForm(false);
      await load();
      onChanged?.();
      setMessage('업무 이력을 추가했습니다.');
    } catch (error) {
      setCreateError((error as Error).message);
    } finally {
      setCreating(false);
    }
  }

  function openEdit(row: ProjectHistoryEntry) {
    setEditingRow(row);
    setEditDraft(toEditDraft(row));
    setEditError('');
  }

  function closeEdit() {
    setEditingRow(null);
    setEditDraft(null);
    setEditError('');
  }

  async function saveEdit() {
    if (!editingRow || !editDraft) return;
    const payload = buildUpdatePayload(editDraft, editingRow);
    if (Object.keys(payload).length === 0) {
      closeEdit();
      return;
    }
    setSaving(true);
    setEditError('');
    try {
      const updated = await apiFetch<ProjectHistoryEntry>(`/projects/history/${editingRow.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      setEntries((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
      onChanged?.();
      closeEdit();
    } catch (error) {
      setEditError((error as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteRow(row: ProjectHistoryEntry) {
    if (!window.confirm(`${row.user_name}님의 "${row.subproject_name}" 이력을 삭제할까요?`)) {
      return;
    }
    setDeletingId(row.id);
    setMessage('');
    try {
      await apiFetch<void>(`/projects/history/${row.id}`, { method: 'DELETE' });
      setEntries((prev) => prev.filter((item) => item.id !== row.id));
      onChanged?.();
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setDeletingId(null);
    }
  }

  function exportRows() {
    downloadExcel(
      `업무_이력_현황_${dateRange.from || '전체'}_${dateRange.to || '전체'}.xls`,
      [
        '담당자',
        '대프로젝트',
        '프로젝트',
        '하위 프로젝트명',
        '유형',
        '시작일',
        '종료일',
        '소요 시간',
        '기록 구분',
      ],
      displayRows.map((row) => [
        row.user_name,
        row.major_project_name ?? '대프로젝트 미지정',
        row.project_name,
        row.subproject_name,
        PROJECT_TYPE_LABEL[row.project_type] ?? row.project_type,
        formatDate(row.started_on),
        formatDate(row.ended_on),
        formatMinutes(row.worked_minutes),
        row.manual_override ? '수동' : '자동',
      ]),
    );
  }

  if (!enabled) {
    return (
      <div className="rounded-2xl border border-verify-fail-bg bg-verify-fail-bg p-6 text-sm text-verify-fail-fg">
        관리자만 사용할 수 있습니다.
      </div>
    );
  }

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-md font-bold text-text">업무 이력 관리</h3>
          <p className="mt-1 text-small text-text-subtle">
            상단 조회 조건에 맞는 업무 이력을 확인하고, 필요한 경우에만 수동 이력을 추가합니다.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={exportRows}
            className="rounded-lg border border-border bg-white px-3 py-2 text-small font-semibold text-text transition hover:border-brand hover:text-brand"
          >
            엑셀 내보내기
          </button>
          <button
            type="button"
            onClick={() => {
              setShowCreateForm((current) => !current);
              setCreateError('');
            }}
            className="rounded-lg bg-brand px-3 py-2 text-small font-semibold text-white transition hover:bg-brand-hover"
          >
            {showCreateForm ? '업무 이력 추가 닫기' : '+ 업무 이력 추가'}
          </button>
        </div>
      </div>

      {showCreateForm && (
        <div className="rounded-xl border border-border bg-white p-3 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h4 className="text-body font-bold text-text">업무 이력 추가</h4>
              <p className="mt-1 text-small text-text-subtle">
                등록된 하위 프로젝트를 선택하거나, 목록에 없는 과거 이력을 직접 입력합니다.
              </p>
            </div>
            {createError && (
              <p className="text-small font-semibold text-verify-fail-fg">{createError}</p>
            )}
          </div>

          <div className="mb-3 flex rounded-xl border border-border bg-surface-muted p-1">
            {[
              { id: 'existing', label: '등록된 하위 프로젝트 선택' },
              { id: 'manual', label: '목록에 없는 이력 직접 입력' },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => updateCreateDraft('mode', item.id as CreateMode)}
                className={`flex-1 rounded-lg px-3 py-2 text-small font-semibold transition ${
                  createDraft.mode === item.id
                    ? 'bg-white text-brand shadow-sm'
                    : 'text-text-subtle hover:text-text'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <label className="block text-small font-semibold text-text-subtle">
              담당자
              <select
                className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-body text-text"
                value={createDraft.user_id}
                onChange={(event) =>
                  updateCreateDraft(
                    'user_id',
                    event.target.value === '' ? '' : Number(event.target.value),
                  )
                }
              >
                <option value="">선택</option>
                {sortedUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
            </label>

            {createDraft.mode === 'existing' ? (
              <>
                <label className="block text-small font-semibold text-text-subtle">
                  대프로젝트
                  <select
                    className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-body text-text"
                    value={createDraft.major_project_id}
                    onChange={(event) =>
                      updateCreateDraft(
                        'major_project_id',
                        event.target.value === '' ? '' : Number(event.target.value),
                      )
                    }
                  >
                    <option value="">전체</option>
                    {sortedMajorProjects.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block text-small font-semibold text-text-subtle">
                  프로젝트
                  <select
                    className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-body text-text"
                    value={createDraft.project_id}
                    onChange={(event) =>
                      updateCreateDraft(
                        'project_id',
                        event.target.value === '' ? '' : Number(event.target.value),
                      )
                    }
                  >
                    <option value="">선택</option>
                    {createProjects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block text-small font-semibold text-text-subtle">
                  하위 프로젝트
                  <select
                    className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-body text-text"
                    value={createDraft.subproject_id}
                    onChange={(event) =>
                      updateCreateDraft(
                        'subproject_id',
                        event.target.value === '' ? '' : Number(event.target.value),
                      )
                    }
                  >
                    <option value="">선택</option>
                    {createSubprojectOptions.map((subproject) => (
                      <option key={subproject.id} value={subproject.id}>
                        {subproject.name}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            ) : (
              <>
                <label className="block text-small font-semibold text-text-subtle">
                  프로젝트명
                  <input
                    type="text"
                    className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-body text-text"
                    value={createDraft.project_name}
                    onChange={(event) =>
                      setCreateDraft((prev) => ({
                        ...prev,
                        project_id: '',
                        subproject_id: '',
                        project_name: event.target.value,
                        project_type: 'manual',
                      }))
                    }
                  />
                </label>

                <label className="block text-small font-semibold text-text-subtle">
                  하위 프로젝트명
                  <input
                    type="text"
                    className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-body text-text"
                    value={createDraft.subproject_name}
                    onChange={(event) =>
                      setCreateDraft((prev) => ({ ...prev, subproject_name: event.target.value }))
                    }
                  />
                </label>
              </>
            )}

            <label className="block text-small font-semibold text-text-subtle">
              시작일
              <input
                type="date"
                className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-body text-text"
                value={createDraft.started_on}
                onChange={(event) =>
                  setCreateDraft((prev) => ({ ...prev, started_on: event.target.value }))
                }
              />
            </label>

            <label className="block text-small font-semibold text-text-subtle">
              종료일
              <input
                type="date"
                className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-body text-text"
                value={createDraft.ended_on}
                onChange={(event) =>
                  setCreateDraft((prev) => ({ ...prev, ended_on: event.target.value }))
                }
              />
            </label>

            <label className="block text-small font-semibold text-text-subtle">
              소요 시간(분)
              <input
                type="number"
                min={0}
                className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-body text-text"
                value={createDraft.worked_minutes}
                onChange={(event) =>
                  setCreateDraft((prev) => ({ ...prev, worked_minutes: event.target.value }))
                }
              />
            </label>

            <label className="block text-small font-semibold text-text-subtle md:col-span-2 xl:col-span-3">
              비고
              <input
                type="text"
                className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-body text-text"
                value={createDraft.keyword_text}
                onChange={(event) =>
                  setCreateDraft((prev) => ({ ...prev, keyword_text: event.target.value }))
                }
              />
            </label>

            <div className="flex items-end md:col-span-1 xl:col-span-2">
              <button
                type="button"
                onClick={() => void createManualHistory()}
                disabled={creating}
                className="w-full rounded-lg bg-brand px-3 py-2 text-body font-semibold text-white transition hover:bg-brand-hover disabled:opacity-50"
              >
                {creating ? '추가 중...' : '이력 추가'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between text-small text-text-subtle">
        <span>
          총 <strong className="text-text">{displayRows.length}</strong>건 · 누적 소요{' '}
          <strong className="text-text">{formatMinutes(totalMinutes)}</strong>
        </span>
        {message && <span className="text-verify-fail-fg">{message}</span>}
        {loading && <span>불러오는 중...</span>}
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-white">
        <table className="w-full text-body">
          <thead className="bg-surface-muted text-left text-small text-text-subtle">
            <tr>
              <th className="px-4 py-3 font-semibold">담당자</th>
              <th className="px-4 py-3 font-semibold">대프로젝트</th>
              <th className="px-4 py-3 font-semibold">프로젝트</th>
              <th className="px-4 py-3 font-semibold">하위 프로젝트명</th>
              <th className="px-4 py-3 font-semibold">유형</th>
              <th className="px-4 py-3 font-semibold">시작일</th>
              <th className="px-4 py-3 font-semibold">종료일</th>
              <th className="px-4 py-3 font-semibold">소요</th>
              <th className="px-4 py-3 text-right font-semibold">작업</th>
            </tr>
          </thead>
          <tbody>
            {displayRows.length === 0 && !loading && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-small text-text-subtle">
                  표시할 업무 이력이 없습니다.
                </td>
              </tr>
            )}
            {displayRows.map((row) => (
              <tr key={row.id} className="border-t border-border text-text">
                <td className="px-4 py-3">{row.user_name}</td>
                <td className="px-4 py-3">{row.major_project_name ?? '대프로젝트 미지정'}</td>
                <td className="px-4 py-3">{row.project_name}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span>{row.subproject_name}</span>
                    {row.manual_override && (
                      <span className="rounded-full bg-brand-soft px-2 py-0.5 text-tiny font-semibold text-brand">
                        수동
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-brand">
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
                      className="rounded-lg border border-border px-2.5 py-1 text-small font-semibold text-text transition hover:border-brand hover:text-brand"
                    >
                      편집
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteRow(row)}
                      disabled={deletingId === row.id}
                      className="rounded-lg border border-verify-fail-bg px-2.5 py-1 text-small font-semibold text-verify-fail-fg transition hover:bg-verify-fail-bg disabled:opacity-50"
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

      <p className="text-small text-text-subtle">
        하위 프로젝트 완료 시 자동 생성된 이력과 관리자가 직접 추가한 수동 이력을 함께 표시합니다.
      </p>

      {editingRow && editDraft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-heading font-bold text-text">업무 이력 편집</h3>
            <p className="mt-1 text-small text-text-subtle">
              {editingRow.user_name} · {editingRow.major_project_name ?? '대프로젝트 미지정'} ·{' '}
              {editingRow.project_name}
            </p>

            <div className="mt-4 space-y-3">
              <label className="block text-small font-semibold text-text-subtle">
                하위 프로젝트명
                <input
                  type="text"
                  className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-body text-text"
                  value={editDraft.subproject_name}
                  onChange={(event) =>
                    setEditDraft((prev) =>
                      prev ? { ...prev, subproject_name: event.target.value } : prev,
                    )
                  }
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-small font-semibold text-text-subtle">
                  시작일
                  <input
                    type="date"
                    className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-body text-text"
                    value={editDraft.started_on}
                    onChange={(event) =>
                      setEditDraft((prev) =>
                        prev ? { ...prev, started_on: event.target.value } : prev,
                      )
                    }
                  />
                </label>
                <label className="block text-small font-semibold text-text-subtle">
                  종료일
                  <input
                    type="date"
                    className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-body text-text"
                    value={editDraft.ended_on}
                    onChange={(event) =>
                      setEditDraft((prev) =>
                        prev ? { ...prev, ended_on: event.target.value } : prev,
                      )
                    }
                  />
                </label>
              </div>
              <label className="block text-small font-semibold text-text-subtle">
                소요 시간(분)
                <input
                  type="number"
                  min={0}
                  className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-body text-text"
                  value={editDraft.worked_minutes}
                  onChange={(event) =>
                    setEditDraft((prev) =>
                      prev ? { ...prev, worked_minutes: event.target.value } : prev,
                    )
                  }
                />
              </label>
              <label className="block text-small font-semibold text-text-subtle">
                비고
                <textarea
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-body text-text"
                  value={editDraft.keyword_text}
                  onChange={(event) =>
                    setEditDraft((prev) =>
                      prev ? { ...prev, keyword_text: event.target.value } : prev,
                    )
                  }
                />
              </label>
            </div>

            {editError && <p className="mt-3 text-small text-verify-fail-fg">{editError}</p>}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeEdit}
                disabled={saving}
                className="rounded-lg border border-border px-3 py-2 text-body font-semibold text-text transition hover:border-text-subtle disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => void saveEdit()}
                disabled={saving}
                className="rounded-lg bg-brand px-3 py-2 text-body font-semibold text-white transition hover:bg-brand-hover disabled:opacity-50"
              >
                {saving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
