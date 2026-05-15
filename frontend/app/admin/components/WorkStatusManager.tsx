'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import {
  apiFetch,
  type MajorProject,
  type Project,
  type ProjectHistoryEntry,
  type WorkLogUserSummary,
} from '../../lib/api';
import AdminOrgScopeTree from './AdminOrgScopeTree';
import WorkHistoryManager from './WorkHistoryManager';

type AdminUser = {
  id: number;
  idnum: string;
  name: string;
  role: string;
  center?: string | null;
  office?: string | null;
  team?: string | null;
  position?: string | null;
  email?: string | null;
  phone?: string | null;
};

type DateRange = {
  from: string;
  to: string;
};

type Props = {
  enabled: boolean;
  users: AdminUser[];
  selectedUserIds?: Set<number> | null;
  onSelectedUserIdsChange?: (ids: Set<number> | null) => void;
  dateRange: DateRange;
  onDateRangeChange?: (range: DateRange) => void;
};

type ViewMode = 'member' | 'project';

type MemberStatusRow = {
  userId: number;
  userName: string;
  orgPath: string;
  totalSeconds: number;
  runningSeconds: number;
  pausedSeconds: number;
  completedSeconds: number;
  historyCount: number;
  historyMinutes: number;
};

type ProjectStatusRow = {
  key: string;
  majorProjectId: number | null;
  projectId: number | null;
  subprojectId: number | null;
  majorProjectName: string;
  projectName: string;
  subprojectName: string;
  userName: string;
  stopwatchSeconds: number;
  historyMinutes: number;
  startedOn: string | null;
  endedOn: string | null;
};

type HistoryTreeSubproject = {
  key: string;
  name: string;
  minutes: number;
  count: number;
  startedOn: string | null;
  endedOn: string | null;
  users: Map<string, number>;
};

type HistoryTreeProject = {
  key: string;
  name: string;
  minutes: number;
  count: number;
  subprojects: HistoryTreeSubproject[];
};

type HistoryTreeMajor = {
  key: string;
  name: string;
  minutes: number;
  count: number;
  projects: HistoryTreeProject[];
};

function formatSeconds(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '-';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours === 0) return `${minutes}분`;
  if (minutes === 0) return `${hours}시간`;
  return `${hours}시간 ${minutes}분`;
}

function formatMinutes(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return '-';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}분`;
  if (mins === 0) return `${hours}시간`;
  return `${hours}시간 ${mins}분`;
}

function formatDate(value: string | null): string {
  if (!value) return '-';
  return value.length >= 10 ? value.slice(0, 10) : value;
}

function mergeStart(current: string | null, next: string | null): string | null {
  if (!next) return current;
  if (!current) return next;
  return next < current ? next : current;
}

function mergeEnd(current: string | null, next: string | null): string | null {
  if (!next) return current;
  if (!current) return next;
  return next > current ? next : current;
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

function buildHistoryTree(rows: ProjectHistoryEntry[]): HistoryTreeMajor[] {
  const majors = new Map<
    string,
    {
      node: Omit<HistoryTreeMajor, 'projects'>;
      projects: Map<
        string,
        {
          node: Omit<HistoryTreeProject, 'subprojects'>;
          subprojects: Map<string, HistoryTreeSubproject>;
        }
      >;
    }
  >();

  rows.forEach((row) => {
    const minutes = row.worked_minutes || 0;
    const majorKey = String(row.major_project_id ?? 'none');
    const projectKey = String(row.project_id ?? `manual:${row.project_name || 'none'}`);
    const subprojectKey = String(row.subproject_id ?? `manual:${row.subproject_name || 'none'}`);

    let major = majors.get(majorKey);
    if (!major) {
      major = {
        node: {
          key: majorKey,
          name: row.major_project_name ?? '대프로젝트 미지정',
          minutes: 0,
          count: 0,
        },
        projects: new Map(),
      };
      majors.set(majorKey, major);
    }
    major.node.minutes += minutes;
    major.node.count += 1;

    let project = major.projects.get(projectKey);
    if (!project) {
      project = {
        node: {
          key: projectKey,
          name: row.project_name || '프로젝트 미지정',
          minutes: 0,
          count: 0,
        },
        subprojects: new Map(),
      };
      major.projects.set(projectKey, project);
    }
    project.node.minutes += minutes;
    project.node.count += 1;

    let subproject = project.subprojects.get(subprojectKey);
    if (!subproject) {
      subproject = {
        key: subprojectKey,
        name: row.subproject_name || '하위 프로젝트 미지정',
        minutes: 0,
        count: 0,
        startedOn: null,
        endedOn: null,
        users: new Map(),
      };
      project.subprojects.set(subprojectKey, subproject);
    }
    subproject.minutes += minutes;
    subproject.count += 1;
    subproject.startedOn = mergeStart(subproject.startedOn, row.started_on);
    subproject.endedOn = mergeEnd(subproject.endedOn, row.ended_on);
    subproject.users.set(row.user_name, (subproject.users.get(row.user_name) ?? 0) + minutes);
  });

  return [...majors.values()]
    .map((major) => ({
      ...major.node,
      projects: [...major.projects.values()]
        .map((project) => ({
          ...project.node,
          subprojects: [...project.subprojects.values()].sort((a, b) =>
            a.name.localeCompare(b.name, 'ko-KR'),
          ),
        }))
        .sort((a, b) => a.name.localeCompare(b.name, 'ko-KR')),
    }))
    .sort((a, b) => {
      if (a.key === 'none') return 1;
      if (b.key === 'none') return -1;
      return a.name.localeCompare(b.name, 'ko-KR');
    });
}

export default function WorkStatusManager({
  enabled,
  users,
  selectedUserIds = null,
  onSelectedUserIdsChange,
  dateRange,
  onDateRangeChange,
}: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>('member');
  const [workRows, setWorkRows] = useState<WorkLogUserSummary[]>([]);
  const [historyRows, setHistoryRows] = useState<ProjectHistoryEntry[]>([]);
  const [majorProjects, setMajorProjects] = useState<MajorProject[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [majorProjectId, setMajorProjectId] = useState<number | ''>('');
  const [projectId, setProjectId] = useState<number | ''>('');
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);
  const [selectedProjectKey, setSelectedProjectKey] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!enabled) return;

    const params = new URLSearchParams();
    if (dateRange.from) params.set('start_date', dateRange.from);
    if (dateRange.to) params.set('end_date', dateRange.to);
    const query = params.toString();

    setLoading(true);
    Promise.all([
      apiFetch<WorkLogUserSummary[]>(`/work-logs/admin-summary${query ? `?${query}` : ''}`),
      apiFetch<ProjectHistoryEntry[]>(`/projects/history${query ? `?${query}` : ''}`),
      apiFetch<MajorProject[]>('/major-projects'),
      apiFetch<Project[]>('/projects'),
    ])
      .then(([nextWorkRows, nextHistoryRows, nextMajorProjects, nextProjects]) => {
        setWorkRows(nextWorkRows);
        setHistoryRows(nextHistoryRows);
        setMajorProjects(nextMajorProjects);
        setProjects(nextProjects);
        setError('');
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [dateRange.from, dateRange.to, enabled, refreshToken]);

  const usersById = useMemo(
    () => new Map(users.map((user) => [user.id, user])),
    [users],
  );

  const workByUser = useMemo(
    () => new Map(workRows.map((row) => [row.user_id, row])),
    [workRows],
  );

  const visibleWorkRows = useMemo(
    () =>
      selectedUserIds
        ? workRows.filter((row) => selectedUserIds.has(row.user_id))
        : workRows,
    [selectedUserIds, workRows],
  );

  const visibleHistoryRows = useMemo(
    () =>
      selectedUserIds
        ? historyRows.filter((row) => selectedUserIds.has(row.user_id))
        : historyRows,
    [historyRows, selectedUserIds],
  );

  useEffect(() => {
    if (selectedMemberId !== null && selectedUserIds && !selectedUserIds.has(selectedMemberId)) {
      setSelectedMemberId(null);
    }
  }, [selectedMemberId, selectedUserIds]);

  useEffect(() => {
    setSelectedMemberId(null);
    setSelectedProjectKey(null);
  }, [dateRange.from, dateRange.to, viewMode]);

  const memberRows = useMemo<MemberStatusRow[]>(() => {
    const rows = new Map<number, MemberStatusRow>();

    const ensureRow = (userId: number, fallbackName: string): MemberStatusRow => {
      const existing = rows.get(userId);
      if (existing) return existing;
      const user = usersById.get(userId);
      const work = workByUser.get(userId);
      const row: MemberStatusRow = {
        userId,
        userName: user?.name ?? work?.user_name ?? fallbackName,
        orgPath:
          [user?.center ?? work?.center, user?.office ?? work?.office, user?.team ?? work?.team]
            .filter(Boolean)
            .join(' / ') || '-',
        totalSeconds: work?.total_seconds ?? 0,
        runningSeconds: work?.running_seconds ?? 0,
        pausedSeconds: work?.paused_seconds ?? 0,
        completedSeconds: work?.completed_seconds ?? 0,
        historyCount: 0,
        historyMinutes: 0,
      };
      rows.set(userId, row);
      return row;
    };

    visibleWorkRows.forEach((work) => ensureRow(work.user_id, work.user_name));
    visibleHistoryRows.forEach((history) => {
      const row = ensureRow(history.user_id, history.user_name);
      row.historyCount += 1;
      row.historyMinutes += history.worked_minutes || 0;
    });

    return [...rows.values()].sort(
      (a, b) =>
        b.totalSeconds - a.totalSeconds ||
        b.historyMinutes - a.historyMinutes ||
        a.userName.localeCompare(b.userName, 'ko-KR'),
    );
  }, [usersById, visibleHistoryRows, visibleWorkRows, workByUser]);

  const sortedMajorProjects = useMemo(
    () => [...majorProjects].sort((a, b) => a.name.localeCompare(b.name, 'ko-KR')),
    [majorProjects],
  );

  const majorFilteredProjects = useMemo(
    () =>
      projects
        .filter((project) => majorProjectId === '' || projectMajorId(project) === majorProjectId)
        .sort((a, b) => a.name.localeCompare(b.name, 'ko-KR')),
    [majorProjectId, projects],
  );

  useEffect(() => {
    if (projectId !== '' && !majorFilteredProjects.some((project) => project.id === projectId)) {
      setProjectId('');
    }
  }, [majorFilteredProjects, projectId]);

  const projectRows = useMemo<ProjectStatusRow[]>(() => {
    const rows = new Map<string, ProjectStatusRow>();
    visibleHistoryRows
      .filter((history) => majorProjectId === '' || history.major_project_id === majorProjectId)
      .filter((history) => projectId === '' || history.project_id === projectId)
      .forEach((history) => {
        const key = [
          history.major_project_id ?? 'none',
          history.project_id ?? 'none',
          history.subproject_id ?? history.subproject_name,
          history.user_id,
        ].join(':');
        const existing = rows.get(key);
        const work = workByUser.get(history.user_id);
        if (existing) {
          existing.historyMinutes += history.worked_minutes || 0;
          existing.startedOn = mergeStart(existing.startedOn, history.started_on);
          existing.endedOn = mergeEnd(existing.endedOn, history.ended_on);
          return;
        }
        rows.set(key, {
          key,
          majorProjectId: history.major_project_id ?? null,
          projectId: history.project_id ?? null,
          subprojectId: history.subproject_id ?? null,
          subprojectName: history.subproject_name || '하위 프로젝트 미지정',
          majorProjectName: history.major_project_name ?? '대프로젝트 미지정',
          projectName: history.project_name || '프로젝트 미지정',
          userName: history.user_name,
          stopwatchSeconds: work?.total_seconds ?? 0,
          historyMinutes: history.worked_minutes || 0,
          startedOn: history.started_on,
          endedOn: history.ended_on,
        });
      });

    return [...rows.values()].sort(
      (a, b) =>
        a.majorProjectName.localeCompare(b.majorProjectName, 'ko-KR') ||
        a.projectName.localeCompare(b.projectName, 'ko-KR') ||
        a.subprojectName.localeCompare(b.subprojectName, 'ko-KR') ||
        a.userName.localeCompare(b.userName, 'ko-KR'),
    );
  }, [majorProjectId, projectId, visibleHistoryRows, workByUser]);

  const selectedProjectRow = useMemo(
    () => projectRows.find((row) => row.key === selectedProjectKey) ?? null,
    [projectRows, selectedProjectKey],
  );

  const selectedDetailRows = useMemo(() => {
    if (viewMode === 'member' && selectedMemberId !== null) {
      return visibleHistoryRows.filter((row) => row.user_id === selectedMemberId);
    }
    if (viewMode === 'project' && selectedProjectRow) {
      return visibleHistoryRows.filter((row) => {
        const sameMajor = (row.major_project_id ?? null) === selectedProjectRow.majorProjectId;
        const sameProject = (row.project_id ?? null) === selectedProjectRow.projectId;
        const sameSubproject =
          selectedProjectRow.subprojectId !== null
            ? row.subproject_id === selectedProjectRow.subprojectId
            : row.subproject_name === selectedProjectRow.subprojectName;
        return sameMajor && sameProject && sameSubproject;
      });
    }
    return [];
  }, [selectedMemberId, selectedProjectRow, viewMode, visibleHistoryRows]);

  const selectedTree = useMemo(
    () => buildHistoryTree(selectedDetailRows),
    [selectedDetailRows],
  );

  const totalStopwatchSeconds = useMemo(
    () => visibleWorkRows.reduce((sum, row) => sum + row.total_seconds, 0),
    [visibleWorkRows],
  );

  const totalHistoryMinutes = useMemo(
    () => visibleHistoryRows.reduce((sum, row) => sum + (row.worked_minutes || 0), 0),
    [visibleHistoryRows],
  );

  const exportRows = () => {
    if (viewMode === 'member') {
      downloadExcel(
        `업무_현황_담당자기준_${dateRange.from || '전체'}_${dateRange.to || '전체'}.xls`,
        ['담당자', '소속', '스톱워치 누적', '진행 중', '완료', '업무 이력 건수', '업무 이력 소요 시간'],
        memberRows.map((row) => [
          row.userName,
          row.orgPath,
          formatSeconds(row.totalSeconds),
          formatSeconds(row.runningSeconds),
          formatSeconds(row.completedSeconds),
          row.historyCount,
          formatMinutes(row.historyMinutes),
        ]),
      );
      return;
    }

    downloadExcel(
      `업무_현황_프로젝트기준_${dateRange.from || '전체'}_${dateRange.to || '전체'}.xls`,
      ['대프로젝트', '프로젝트', '하위 프로젝트', '담당자', '담당자 기간 스톱워치', '업무 이력 소요 시간', '기간'],
      projectRows.map((row) => [
        row.majorProjectName,
        row.projectName,
        row.subprojectName,
        row.userName,
        formatSeconds(row.stopwatchSeconds),
        formatMinutes(row.historyMinutes),
        `${formatDate(row.startedOn)} ~ ${formatDate(row.endedOn)}`,
      ]),
    );
  };

  if (!enabled) {
    return null;
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-border bg-white p-4">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-md font-bold text-text">통합 업무 현황</h3>
            <p className="mt-1 text-small text-text-subtle">
              조직도와 조회 기간을 기준으로 스톱워치 시간과 업무 이력을 함께 확인합니다.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-xl border border-border bg-surface-muted p-1">
              {[
                { id: 'member', label: '담당자 기준' },
                { id: 'project', label: '프로젝트 기준' },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setViewMode(item.id as ViewMode)}
                  className={`rounded-lg px-3 py-2 text-small font-semibold transition ${
                    viewMode === item.id
                      ? 'bg-white text-brand shadow-sm'
                      : 'text-text-subtle hover:text-text'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={exportRows}
              className="rounded-lg border border-brand-soft bg-white px-3 py-2 text-small font-semibold text-brand transition hover:bg-brand-soft"
            >
              엑셀 내보내기
            </button>
          </div>
        </div>

        <div className="mb-4 grid grid-cols-1 gap-3 xl:grid-cols-[minmax(320px,420px)_1fr]">
          {onSelectedUserIdsChange && (
            <AdminOrgScopeTree
              users={users}
              selectedIds={selectedUserIds}
              onSelect={onSelectedUserIdsChange}
            />
          )}
          {onDateRangeChange && (
            <div className="rounded-xl border border-border bg-surface-muted p-3">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="text-body font-bold text-text">조회 기간</h4>
                  <p className="mt-1 text-small text-text-subtle">
                    선택한 담당자와 기간이 현황 표와 업무 이력에 함께 적용됩니다.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onDateRangeChange({ from: '', to: '' })}
                  className="rounded-lg border border-border bg-white px-3 py-2 text-small font-semibold text-brand transition hover:bg-brand-soft"
                >
                  기간 초기화
                </button>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="block text-small font-semibold text-text-subtle">
                  시작일
                  <input
                    type="date"
                    className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-body text-text"
                    value={dateRange.from}
                    onChange={(event) =>
                      onDateRangeChange({ ...dateRange, from: event.target.value })
                    }
                  />
                </label>
                <label className="block text-small font-semibold text-text-subtle">
                  종료일
                  <input
                    type="date"
                    className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-body text-text"
                    value={dateRange.to}
                    onChange={(event) =>
                      onDateRangeChange({ ...dateRange, to: event.target.value })
                    }
                  />
                </label>
              </div>
            </div>
          )}
        </div>

        <div className="mb-4 flex flex-wrap gap-2 text-small">
          <span className="rounded-lg bg-brand-soft px-3 py-2 font-semibold text-brand">
            스톱워치 누적 {formatSeconds(totalStopwatchSeconds)}
          </span>
          <span className="rounded-lg bg-verify-pass-bg px-3 py-2 font-semibold text-verify-pass-fg">
            업무 이력 {visibleHistoryRows.length}건
          </span>
          <span className="rounded-lg bg-surface-muted px-3 py-2 font-semibold text-text-subtle">
            이력 소요 {formatMinutes(totalHistoryMinutes)}
          </span>
        </div>

        {viewMode === 'project' && (
          <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="block text-small font-semibold text-text-subtle">
              대프로젝트
              <select
                className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-body text-text"
                value={majorProjectId}
                onChange={(event) => {
                  setMajorProjectId(event.target.value === '' ? '' : Number(event.target.value));
                  setProjectId('');
                  setSelectedProjectKey(null);
                }}
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
                value={projectId}
                onChange={(event) => {
                  setProjectId(event.target.value === '' ? '' : Number(event.target.value));
                  setSelectedProjectKey(null);
                }}
              >
                <option value="">전체</option>
                {majorFilteredProjects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        {error && (
          <p className="mb-3 rounded-lg bg-verify-fail-bg px-3 py-2 text-small text-verify-fail-fg">
            {error}
          </p>
        )}

        {loading ? (
          <p className="rounded-xl bg-surface-muted px-4 py-5 text-center text-small text-text-subtle">
            업무 현황을 불러오는 중입니다.
          </p>
        ) : viewMode === 'member' ? (
          <MemberStatusTable
            rows={memberRows}
            selectedMemberId={selectedMemberId}
            selectedTree={selectedTree}
            onSelect={(userId) =>
              setSelectedMemberId(selectedMemberId === userId ? null : userId)
            }
          />
        ) : (
          <ProjectStatusTable
            rows={projectRows}
            selectedProjectKey={selectedProjectKey}
            selectedTree={selectedTree}
            onSelect={(key) => setSelectedProjectKey(selectedProjectKey === key ? null : key)}
          />
        )}
      </section>

      <WorkHistoryManager
        enabled={enabled}
        users={users}
        selectedUserIds={selectedUserIds}
        dateRange={dateRange}
        onChanged={() => setRefreshToken((value) => value + 1)}
      />
    </div>
  );
}

function MemberStatusTable({
  rows,
  selectedMemberId,
  selectedTree,
  onSelect,
}: {
  rows: MemberStatusRow[];
  selectedMemberId: number | null;
  selectedTree: HistoryTreeMajor[];
  onSelect: (userId: number) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-body">
        <thead className="bg-surface-muted text-small text-text-subtle">
          <tr>
            <th className="px-4 py-3 font-semibold">담당자</th>
            <th className="px-4 py-3 font-semibold">소속</th>
            <th className="px-4 py-3 font-semibold">스톱워치 누적</th>
            <th className="px-4 py-3 font-semibold">진행 중</th>
            <th className="px-4 py-3 font-semibold">일시정지</th>
            <th className="px-4 py-3 font-semibold">완료</th>
            <th className="px-4 py-3 font-semibold">업무 이력 건수</th>
            <th className="px-4 py-3 font-semibold">이력 소요</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const active = selectedMemberId === row.userId;
            return (
              <Fragment key={row.userId}>
                <tr
                  onClick={() => onSelect(row.userId)}
                  className={`cursor-pointer border-t border-border text-text transition hover:bg-surface-muted ${
                    active ? 'bg-brand-soft/50' : ''
                  }`}
                >
                  <td className="px-4 py-3 font-semibold">{row.userName}</td>
                  <td className="px-4 py-3 text-text-muted">{row.orgPath}</td>
                  <td className="px-4 py-3">{formatSeconds(row.totalSeconds)}</td>
                  <td className="px-4 py-3 text-verify-pass-fg">
                    {formatSeconds(row.runningSeconds)}
                  </td>
                  <td className="px-4 py-3">{formatSeconds(row.pausedSeconds)}</td>
                  <td className="px-4 py-3">{formatSeconds(row.completedSeconds)}</td>
                  <td className="px-4 py-3">{row.historyCount}</td>
                  <td className="px-4 py-3">{formatMinutes(row.historyMinutes)}</td>
                </tr>
                {active && (
                  <tr className="border-t border-border">
                    <td colSpan={8} className="bg-surface-muted px-4 py-3">
                      <HistoryTreePanel tree={selectedTree} />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
          {rows.length === 0 && (
            <tr>
              <td colSpan={8} className="px-4 py-8 text-center text-small text-text-subtle">
                표시할 업무 현황이 없습니다.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function ProjectStatusTable({
  rows,
  selectedProjectKey,
  selectedTree,
  onSelect,
}: {
  rows: ProjectStatusRow[];
  selectedProjectKey: string | null;
  selectedTree: HistoryTreeMajor[];
  onSelect: (key: string) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-body">
        <thead className="bg-surface-muted text-small text-text-subtle">
          <tr>
            <th className="px-4 py-3 font-semibold">대프로젝트</th>
            <th className="px-4 py-3 font-semibold">프로젝트</th>
            <th className="px-4 py-3 font-semibold">하위 프로젝트</th>
            <th className="px-4 py-3 font-semibold">담당자</th>
            <th className="px-4 py-3 font-semibold">담당자 기간 스톱워치</th>
            <th className="px-4 py-3 font-semibold">업무 이력 소요</th>
            <th className="px-4 py-3 font-semibold">기간</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const active = selectedProjectKey === row.key;
            return (
              <Fragment key={row.key}>
                <tr
                  onClick={() => onSelect(row.key)}
                  className={`cursor-pointer border-t border-border text-text transition hover:bg-surface-muted ${
                    active ? 'bg-brand-soft/50' : ''
                  }`}
                >
                  <td className="px-4 py-3">{row.majorProjectName}</td>
                  <td className="px-4 py-3">{row.projectName}</td>
                  <td className="px-4 py-3 font-semibold">{row.subprojectName}</td>
                  <td className="px-4 py-3">{row.userName}</td>
                  <td className="px-4 py-3">{formatSeconds(row.stopwatchSeconds)}</td>
                  <td className="px-4 py-3">{formatMinutes(row.historyMinutes)}</td>
                  <td className="px-4 py-3 text-text-muted">
                    {formatDate(row.startedOn)} ~ {formatDate(row.endedOn)}
                  </td>
                </tr>
                {active && (
                  <tr className="border-t border-border">
                    <td colSpan={7} className="bg-surface-muted px-4 py-3">
                      <HistoryTreePanel tree={selectedTree} />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
          {rows.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-8 text-center text-small text-text-subtle">
                표시할 프로젝트 기준 업무 현황이 없습니다.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function HistoryTreePanel({ tree }: { tree: HistoryTreeMajor[] }) {
  if (tree.length === 0) {
    return (
      <p className="rounded-lg bg-white px-3 py-4 text-center text-small text-text-subtle">
        조회 기간에 해당하는 수행 프로젝트가 없습니다.
      </p>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-white p-3">
      <p className="mb-2 text-small font-bold text-text">수행 프로젝트</p>
      <ul className="space-y-1.5">
        {tree.map((major) => (
          <li key={major.key}>
            <TreeRow
              depth={0}
              label={major.name}
              count={major.count}
              meta={formatMinutes(major.minutes)}
            />
            <ul className="mt-1 space-y-1 pl-5">
              {major.projects.map((project) => (
                <li key={project.key}>
                  <TreeRow
                    depth={1}
                    label={project.name}
                    count={project.count}
                    meta={formatMinutes(project.minutes)}
                  />
                  <ul className="mt-1 max-h-[240px] space-y-1 overflow-y-auto pl-5 pr-1">
                    {project.subprojects.map((subproject) => (
                      <li key={subproject.key}>
                        <div className="rounded-lg bg-surface px-3 py-2">
                          <div className="flex items-center gap-2">
                            <span className="h-[6px] w-[6px] shrink-0 rounded-full bg-brand" />
                            <span className="min-w-0 flex-1 truncate text-small font-semibold text-text">
                              {subproject.name}
                            </span>
                            <span className="shrink-0 text-tiny text-text-subtle">
                              {formatMinutes(subproject.minutes)}
                            </span>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-2 pl-4 text-tiny text-text-subtle">
                            <span>
                              {formatDate(subproject.startedOn)} ~ {formatDate(subproject.endedOn)}
                            </span>
                            {[...subproject.users.entries()].map(([userName, minutes]) => (
                              <span
                                key={userName}
                                className="rounded-full bg-surface-muted px-2 py-0.5"
                              >
                                {userName} {formatMinutes(minutes)}
                              </span>
                            ))}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TreeRow({
  depth,
  label,
  count,
  meta,
}: {
  depth: 0 | 1;
  label: string;
  count: number;
  meta: string;
}) {
  return (
    <div
      className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 font-semibold ${
        depth === 0 ? 'bg-surface text-text' : 'bg-surface-muted text-text-muted'
      }`}
    >
      <span className="text-nano text-text-subtle">›</span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className="shrink-0 text-tiny font-medium text-text-faint">{count}건</span>
      <span className="shrink-0 text-tiny font-medium text-text-subtle">{meta}</span>
    </div>
  );
}
