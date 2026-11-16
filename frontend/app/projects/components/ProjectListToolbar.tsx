'use client';

import { useMemo } from 'react';
import {
  PROJECT_TYPE_LABEL,
  type MajorProject,
  type Project,
  type SubProject,
} from '../../lib/api';

export type ProjectSortKey =
  | 'default'
  | 'name'
  | 'start_date'
  | 'end_date'
  | 'progress_desc';

/** B-108: 검색어를 어디에서 찾을지 */
export type ProjectQueryScope = 'all' | 'project' | 'subproject';

export type ProjectListFilter = {
  query: string;
  queryScope: ProjectQueryScope;
  projectType: string;
  majorProjectId: number | '';
  sortKey: ProjectSortKey;
};

export const EMPTY_PROJECT_LIST_FILTER: ProjectListFilter = {
  query: '',
  queryScope: 'all',
  projectType: '',
  majorProjectId: '',
  sortKey: 'default',
};

const QUERY_SCOPE_LABEL: Record<ProjectQueryScope, string> = {
  all: '전체',
  project: '프로젝트',
  subproject: '하위 프로젝트',
};

const QUERY_PLACEHOLDER: Record<ProjectQueryScope, string> = {
  all: '프로젝트·하위 프로젝트 이름 검색',
  project: '프로젝트 이름 검색',
  subproject: '하위 프로젝트 이름 검색',
};

const SORT_LABEL: Record<ProjectSortKey, string> = {
  default: '기본 순서',
  name: '이름순',
  start_date: '시작일순',
  end_date: '종료일순',
  progress_desc: '진행률 높은 순',
};

const controlClass =
  'h-9 rounded-lg border border-border bg-white px-3 text-sm text-text outline-none transition focus:border-brand focus:ring-2 focus:ring-indigo-100';

type Props = {
  value: ProjectListFilter;
  onChange: (next: ProjectListFilter) => void;
  projects: Project[];
  majorProjects: MajorProject[];
  visibleCount: number;
};

export default function ProjectListToolbar({
  value,
  onChange,
  projects,
  majorProjects,
  visibleCount,
}: Props) {
  const projectTypes = useMemo(
    () => Array.from(new Set(projects.map((project) => project.project_type))),
    [projects],
  );
  const isFiltered =
    value.query.trim() !== '' || value.projectType !== '' || value.majorProjectId !== '';

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-white px-4 py-3">
      <input
        type="search"
        value={value.query}
        onChange={(event) => onChange({ ...value, query: event.target.value })}
        placeholder={QUERY_PLACEHOLDER[value.queryScope]}
        aria-label={QUERY_PLACEHOLDER[value.queryScope]}
        className={`${controlClass} min-w-[200px] flex-1`}
      />
      <select
        value={value.queryScope}
        onChange={(event) =>
          onChange({ ...value, queryScope: event.target.value as ProjectQueryScope })
        }
        aria-label="검색 대상"
        title="검색어를 프로젝트 이름에서 찾을지, 하위 프로젝트 이름에서 찾을지 고릅니다."
        className={controlClass}
      >
        {(Object.keys(QUERY_SCOPE_LABEL) as ProjectQueryScope[]).map((scope) => (
          <option key={scope} value={scope}>
            {QUERY_SCOPE_LABEL[scope]}
          </option>
        ))}
      </select>
      <select
        value={value.majorProjectId}
        onChange={(event) =>
          onChange({
            ...value,
            majorProjectId: event.target.value === '' ? '' : Number(event.target.value),
          })
        }
        aria-label="대프로젝트 필터"
        className={controlClass}
      >
        <option value="">전체 대프로젝트</option>
        {majorProjects.map((majorProject) => (
          <option key={majorProject.id} value={majorProject.id}>
            {majorProject.name}
          </option>
        ))}
      </select>
      <select
        value={value.projectType}
        onChange={(event) => onChange({ ...value, projectType: event.target.value })}
        aria-label="프로젝트 유형 필터"
        className={controlClass}
      >
        <option value="">전체 유형</option>
        {projectTypes.map((type) => (
          <option key={type} value={type}>
            {PROJECT_TYPE_LABEL[type] ?? type}
          </option>
        ))}
      </select>
      <select
        value={value.sortKey}
        onChange={(event) =>
          onChange({ ...value, sortKey: event.target.value as ProjectSortKey })
        }
        aria-label="정렬"
        className={controlClass}
      >
        {(Object.keys(SORT_LABEL) as ProjectSortKey[]).map((key) => (
          <option key={key} value={key}>
            {SORT_LABEL[key]}
          </option>
        ))}
      </select>
      <span className="text-xs text-text-subtle">
        {visibleCount}/{projects.length}개
      </span>
      {isFiltered && (
        <button
          type="button"
          onClick={() =>
            onChange({
              ...EMPTY_PROJECT_LIST_FILTER,
              sortKey: value.sortKey,
              queryScope: value.queryScope,
            })
          }
          className="text-xs font-semibold text-brand hover:underline"
        >
          필터 초기화
        </button>
      )}
    </div>
  );
}

/** B-108: 이름에 검색어가 들어 있는 하위 프로젝트만 돌려준다. 검색어가 비면 빈 배열. */
export function matchSubprojectsByQuery<T extends Pick<SubProject, 'name'>>(
  subprojects: T[],
  rawQuery: string,
): T[] {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return [];
  return subprojects.filter((subproject) => subproject.name.toLowerCase().includes(query));
}

export function applyProjectListFilter(
  projects: Project[],
  filter: ProjectListFilter,
  subprojectsByProject: Map<number, Pick<SubProject, 'name'>[]> = new Map(),
): Project[] {
  const query = filter.query.trim().toLowerCase();
  const scope = filter.queryScope ?? 'all';
  const filtered = projects.filter((project) => {
    if (query) {
      const byName = scope !== 'subproject' && project.name.toLowerCase().includes(query);
      const bySub =
        scope !== 'project' &&
        matchSubprojectsByQuery(subprojectsByProject.get(project.id) ?? [], query).length > 0;
      if (!byName && !bySub) return false;
    }
    if (filter.projectType && project.project_type !== filter.projectType) return false;
    if (filter.majorProjectId !== '' && project.major_project_id !== filter.majorProjectId) {
      return false;
    }
    return true;
  });

  if (filter.sortKey === 'default') return filtered;

  const byDate = (left?: string | null, right?: string | null) => {
    if (!left && !right) return 0;
    if (!left) return 1;
    if (!right) return -1;
    return left.localeCompare(right);
  };

  return [...filtered].sort((left, right) => {
    switch (filter.sortKey) {
      case 'name':
        return left.name.localeCompare(right.name, 'ko');
      case 'start_date':
        return byDate(left.start_date, right.start_date);
      case 'end_date':
        return byDate(left.end_date, right.end_date);
      case 'progress_desc':
        return (right.progress_percent ?? 0) - (left.progress_percent ?? 0);
      default:
        return 0;
    }
  });
}
