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

type Props = {
  enabled: boolean;
  users: AdminUser[];
  selectedUserIds?: Set<number> | null;
  dateRange: DateRange;
  onDateRangeChange?: (range: DateRange) => void;
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

function formatMinutesForExport(min: number): string {
  if (!Number.isFinite(min) || min <= 0) return '-';
  const hours = Math.floor(min / 60);
  const mins = min % 60;
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

export default function WorkHistoryManager({
  enabled,
  users,
  selectedUserIds = null,
  dateRange,
  onDateRangeChange,
}: Props) {
  const [entries, setEntries] = useState<ProjectHistoryEntry[]>([]);
  const [majorProjects, setMajorProjects] = useState<MajorProject[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [subprojects, setSubprojects] = useState<SubProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [majorProjectId, setMajorProjectId] = useState<number | ''>('');
  const [projectId, setProjectId] = useState<number | ''>('');
  const [createMajorProjectId, setCreateMajorProjectId] = useState<number | ''>('');
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
      if (majorProjectId !== '') params.set('major_project_id', String(majorProjectId));
      if (projectId !== '') params.set('project_id', String(projectId));
      if (dateRange.from) params.set('start_date', dateRange.from);
      if (dateRange.to) params.set('end_date', dateRange.to);
      const qs = params.toString();
      const [historyRows, majorProjectRows, projectRows, subprojectRows] = await Promise.all([
        apiFetch<ProjectHistoryEntry[]>(
          `/projects/history${qs ? `?${qs}` : ''}`,
        ),
        majorProjects.length === 0
          ? apiFetch<MajorProject[]>('/major-projects')
          : Promise.resolve(majorProjects),
        projects.length === 0
          ? apiFetch<Project[]>('/projects')
          : Promise.resolve(projects),
        subprojects.length === 0
          ? apiFetch<SubProject[]>('/subprojects')
          : Promise.resolve(subprojects),
      ]);
      setEntries(historyRows);
      if (majorProjects.length === 0) setMajorProjects(majorProjectRows);
      if (projects.length === 0) setProjects(projectRows);
      if (subprojects.length === 0) setSubprojects(subprojectRows);
      setMessage('');
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange.from, dateRange.to, enabled, majorProjectId, projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    let rows = entries;
    if (selectedUserIds) {
      rows = rows.filter((row) => selectedUserIds.has(row.user_id));
    }
    if (dateRange.from) {
      rows = rows.filter(
        (row) => row.ended_on !== null && row.ended_on >= dateRange.from,
      );
    }
    if (dateRange.to) {
      rows = rows.filter(
        (row) => row.ended_on !== null && row.ended_on <= dateRange.to,
      );
    }
    return rows;
  }, [dateRange.from, dateRange.to, entries, selectedUserIds]);

  const sampleEntries = useMemo<ProjectHistoryEntry[]>(
    () =>
      (selectedUserIds
        ? users.filter((user) => selectedUserIds.has(user.id))
        : users
      ).slice(0, 5).map((user, index) => ({
        id: -(index + 1),
        user_id: user.id,
        user_name: user.name,
        major_project_id: null,
        major_project_name: null,
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

  const exportRows = () => {
    downloadExcel(
      `업무_이력_현황_${dateRange.from || '전체'}_${dateRange.to || '전체'}.xls`,
      ['담당자', '대프로젝트', '프로젝트', '하위 프로젝트', '유형', '시작일', '종료일', '소요 시간', '기록 구분'],
      displayRows.map((row) => [
        row.user_name,
        row.major_project_name ?? '대프로젝트 미지정',
        row.project_name,
        row.subproject_name,
        PROJECT_TYPE_LABEL[row.project_type] ?? row.project_type,
        formatDate(row.started_on),
        formatDate(row.ended_on),
        formatMinutesForExport(row.worked_minutes),
        row.manual_override ? '수동' : '자동',
      ]),
    );
  };

  const sortedUsers = useMemo(
    () => [...users].sort((a, b) => a.name.localeCompare(b.name, 'ko-KR')),
    [users],
  );
  const sortedMajorProjects = useMemo(
    () =>
      [...majorProjects].sort((a, b) =>
        a.name.localeCompare(b.name, 'ko-KR'),
      ),
    [majorProjects],
  );
  const projectMajorId = useCallback(
    (project: Project) => project.major_project_id ?? project.major_project?.id ?? null,
    [],
  );
  const majorFilteredProjects = useMemo(
    () =>
      projects.filter(
        (project) => majorProjectId === '' || projectMajorId(project) === majorProjectId,
      ),
    [majorProjectId, projectMajorId, projects],
  );
  const createMajorFilteredProjects = useMemo(
    () =>
      projects.filter(
        (project) =>
          createMajorProjectId === '' || projectMajorId(project) === createMajorProjectId,
      ),
    [createMajorProjectId, projectMajorId, projects],
  );
  const sortedProjects = useMemo(
    () =>
      [...majorFilteredProjects].sort((a, b) =>
        a.name.localeCompare(b.name, 'ko-KR'),
      ),
    [majorFilteredProjects],
  );
  const majorFilteredProjectIds = useMemo(
    () => new Set(majorFilteredProjects.map((project) => project.id)),
    [majorFilteredProjects],
  );
  const sortedCreateProjects = useMemo(
    () =>
      [...createMajorFilteredProjects].sort((a, b) =>
        a.name.localeCompare(b.name, 'ko-KR'),
      ),
    [createMajorFilteredProjects],
  );
  const createMajorFilteredProjectIds = useMemo(
    () => new Set(createMajorFilteredProjects.map((project) => project.id)),
    [createMajorFilteredProjects],
  );
  const createSubprojectOptions = useMemo(
    () =>
      subprojects
        .filter((sp) =>
          createDraft.project_id === ''
            ? createMajorProjectId === '' || createMajorFilteredProjectIds.has(sp.project_id)
            : sp.project_id === createDraft.project_id,
        )
        .sort((a, b) => a.name.localeCompare(b.name, 'ko-KR')),
    [createDraft.project_id, createMajorFilteredProjectIds, createMajorProjectId, subprojects],
  );

  useEffect(() => {
    if (majorProjectId === '') return;
    if (projectId !== '' && !majorFilteredProjectIds.has(projectId)) {
      setProjectId('');
    }
  }, [majorFilteredProjectIds, majorProjectId, projectId]);

  useEffect(() => {
    if (createMajorProjectId === '') return;
    if (
      createDraft.project_id !== '' &&
      !createMajorFilteredProjectIds.has(createDraft.project_id)
    ) {
      setCreateDraft((prev) => ({
        ...prev,
        project_id: '',
        project_name: '',
        project_type: 'manual',
        subproject_id: '',
        subproject_name: '',
        started_on: '',
        ended_on: '',
      }));
    }
  }, [createDraft.project_id, createMajorFilteredProjectIds, createMajorProjectId]);

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
      <div className="rounded-2xl border border-verify-fail-bg bg-verify-fail-bg p-6 text-sm text-verify-fail-fg">
        관리자만 사용할 수 있습니다.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-border bg-white p-4">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-md font-bold text-text">
              업무 이력 추가
            </h3>
            <p className="mt-1 text-small text-text-subtle">
              담당자별 수행 업무와 기간, 소요 시간을 직접 기록합니다.
            </p>
          </div>
          {createError && (
            <p className="text-small font-semibold text-verify-fail-fg">
              {createError}
            </p>
          )}
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <div>
            <label className="block text-small font-semibold text-text-subtle">
              담당자
            </label>
            <select
              className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-body text-text"
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
            <label className="block text-small font-semibold text-text-subtle">
              대프로젝트
            </label>
            <select
              className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-body text-text"
              value={createMajorProjectId}
              onChange={(e) => {
                setCreateMajorProjectId(e.target.value === '' ? '' : Number(e.target.value));
              }}
            >
              <option value="">전체</option>
              {sortedMajorProjects.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-small font-semibold text-text-subtle">
              프로젝트
            </label>
            <select
              className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-body text-text"
              value={createDraft.project_id}
              onChange={(e) =>
                updateCreateDraft(
                  'project_id',
                  e.target.value === '' ? '' : Number(e.target.value),
                )
              }
            >
              <option value="">전체</option>
              {sortedCreateProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-small font-semibold text-text-subtle">
              프로젝트명
            </label>
            <input
              type="text"
              className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-body text-text"
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
            <label className="block text-small font-semibold text-text-subtle">
              하위 프로젝트
            </label>
            <select
              className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-body text-text"
              value={createDraft.subproject_id}
              onChange={(e) =>
                updateCreateDraft(
                  'subproject_id',
                  e.target.value === '' ? '' : Number(e.target.value),
                )
              }
            >
              <option value="">선택 안 함</option>
              {createSubprojectOptions.map((sp) => (
                <option key={sp.id} value={sp.id}>
                  {sp.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-small font-semibold text-text-subtle">
              업무명
            </label>
            <input
              type="text"
              className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-body text-text"
              value={createDraft.subproject_name}
              onChange={(e) =>
                setCreateDraft((prev) => ({ ...prev, subproject_name: e.target.value }))
              }
              placeholder="예: 환경 구성"
            />
          </div>
          <div>
            <label className="block text-small font-semibold text-text-subtle">
              시작일
            </label>
            <input
              type="date"
              className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-body text-text"
              value={createDraft.started_on}
              onChange={(e) =>
                setCreateDraft((prev) => ({ ...prev, started_on: e.target.value }))
              }
            />
          </div>
          <div>
            <label className="block text-small font-semibold text-text-subtle">
              종료일
            </label>
            <input
              type="date"
              className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-body text-text"
              value={createDraft.ended_on}
              onChange={(e) =>
                setCreateDraft((prev) => ({ ...prev, ended_on: e.target.value }))
              }
            />
          </div>
          <div>
            <label className="block text-small font-semibold text-text-subtle">
              소요 시간 (분)
            </label>
            <input
              type="number"
              min={0}
              className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-body text-text"
              value={createDraft.worked_minutes}
              onChange={(e) =>
                setCreateDraft((prev) => ({ ...prev, worked_minutes: e.target.value }))
              }
            />
          </div>
          <div className="md:col-span-2 xl:col-span-4">
            <label className="block text-small font-semibold text-text-subtle">
              비고/메모
            </label>
            <input
              type="text"
              className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-body text-text"
              value={createDraft.keyword_text}
              onChange={(e) =>
                setCreateDraft((prev) => ({ ...prev, keyword_text: e.target.value }))
              }
              placeholder="선택"
            />
          </div>
          <div className="md:col-span-1 xl:col-span-2 flex items-end">
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
      </section>

      <section className="rounded-2xl border border-border bg-white p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
          <div>
            <label className="block text-small font-semibold text-text-subtle">
              대프로젝트 필터
            </label>
            <select
              className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-body text-text"
              value={majorProjectId}
              onChange={(e) => {
                setMajorProjectId(e.target.value === '' ? '' : Number(e.target.value));
                setProjectId('');
              }}
            >
              <option value="">전체</option>
              {sortedMajorProjects.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-small font-semibold text-text-subtle">
              프로젝트 필터
            </label>
            <select
              className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-body text-text"
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
            <label className="block text-small font-semibold text-text-subtle">
              완료일 시작
            </label>
            <input
              type="date"
              className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-body text-text"
              value={dateRange.from}
              onChange={(e) =>
                onDateRangeChange?.({ ...dateRange, from: e.target.value })
              }
            />
          </div>
          <div>
            <label className="block text-small font-semibold text-text-subtle">
              완료일 종료
            </label>
            <input
              type="date"
              className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-body text-text"
              value={dateRange.to}
              onChange={(e) =>
                onDateRangeChange?.({ ...dateRange, to: e.target.value })
              }
            />
          </div>
          <div className="flex items-end">
            <label className="flex w-full items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-body text-text">
              <input
                type="checkbox"
                checked={showSampleRows}
                onChange={(e) => setShowSampleRows(e.target.checked)}
              />
              샘플 행 보기
            </label>
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={exportRows}
              className="w-full rounded-lg border border-border bg-white px-3 py-2 text-body font-semibold text-text transition hover:border-brand hover:text-brand"
            >
              엑셀로 내보내기
            </button>
          </div>
        </div>
      </section>

      <div className="flex items-center justify-between text-small text-text-subtle">
        <span>
          총 <strong className="text-text">{displayRows.length}</strong>건 · 누적 소요{' '}
          <strong className="text-text">{formatMinutes(displayTotalMinutes)}</strong>
          {showSampleRows && (
            <span className="ml-2 rounded-full bg-brand-soft px-2 py-0.5 text-tiny font-semibold text-brand">
              샘플 미리보기
            </span>
          )}
        </span>
        {message && <span className="text-verify-fail-fg">{message}</span>}
        {loading && <span>불러오는 중...</span>}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-white">
        <table className="w-full text-body">
          <thead className="bg-surface-muted text-left text-small text-text-subtle">
            <tr>
              <th className="px-4 py-3 font-semibold">담당자</th>
              <th className="px-4 py-3 font-semibold">대프로젝트</th>
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
                <td colSpan={9} className="px-4 py-8 text-center text-small text-text-subtle">
                  표시할 업무 이력이 없습니다.
                </td>
              </tr>
            )}
            {displayRows.map((row) => (
              <tr key={row.id} className="border-t border-border text-text">
                <td className="px-4 py-3">{row.user_name}</td>
                <td className="px-4 py-3">
                  {row.major_project_name ?? '대프로젝트 미지정'}
                </td>
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
                  {row.id < 0 ? (
                    <span className="text-small text-text-subtle">샘플</span>
                  ) : (
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
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-small text-text-subtle">
        업무 이력은 소프로젝트 완료 시 자동으로 기록됩니다. 관리자가 편집한 행은{' '}
        <span className="mx-1 rounded-full bg-brand-soft px-2 py-0.5 text-tiny font-semibold text-brand">
          수동
        </span>
        뱃지가 붙으며 이후 자동 동기화로 덮어쓰이지 않습니다.
      </p>

      {editingRow && draft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-heading font-bold text-text">업무 이력 편집</h3>
            <p className="mt-1 text-small text-text-subtle">
              {editingRow.user_name} · {editingRow.project_name}
            </p>

            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-small font-semibold text-text-subtle">
                  업무 이름
                </label>
                <input
                  type="text"
                  className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-body text-text"
                  value={draft.subproject_name}
                  onChange={(e) =>
                    setDraft((d) => (d ? { ...d, subproject_name: e.target.value } : d))
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-small font-semibold text-text-subtle">
                    시작일
                  </label>
                  <input
                    type="date"
                    className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-body text-text"
                    value={draft.started_on}
                    onChange={(e) =>
                      setDraft((d) => (d ? { ...d, started_on: e.target.value } : d))
                    }
                  />
                </div>
                <div>
                  <label className="block text-small font-semibold text-text-subtle">
                    종료일
                  </label>
                  <input
                    type="date"
                    className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-body text-text"
                    value={draft.ended_on}
                    onChange={(e) =>
                      setDraft((d) => (d ? { ...d, ended_on: e.target.value } : d))
                    }
                  />
                </div>
              </div>
              <div>
                <label className="block text-small font-semibold text-text-subtle">
                  소요 시간 (분)
                </label>
                <input
                  type="number"
                  min={0}
                  className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-body text-text"
                  value={draft.worked_minutes}
                  onChange={(e) =>
                    setDraft((d) => (d ? { ...d, worked_minutes: e.target.value } : d))
                  }
                />
              </div>
              <div>
                <label className="block text-small font-semibold text-text-subtle">
                  비고/메모{' '}
                  <span className="text-text-faint">(선택, 입력 시 keyword_text 갱신)</span>
                </label>
                <textarea
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-body text-text"
                  value={draft.keyword_text}
                  onChange={(e) =>
                    setDraft((d) => (d ? { ...d, keyword_text: e.target.value } : d))
                  }
                />
              </div>
            </div>

            {editError && (
              <p className="mt-3 text-small text-verify-fail-fg">{editError}</p>
            )}

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
    </div>
  );
}
