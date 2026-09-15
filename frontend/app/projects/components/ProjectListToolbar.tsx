'use client';

import { useMemo } from 'react';
import {
  PROJECT_TYPE_LABEL,
  type MajorProject,
  type Project,
} from '../../lib/api';

export type ProjectSortKey =
  | 'default'
  | 'name'
  | 'start_date'
  | 'end_date'
  | 'progress_desc';

export type ProjectListFilter = {
  query: string;
  projectType: string;
  majorProjectId: number | '';
  sortKey: ProjectSortKey;
};

export const EMPTY_PROJECT_LIST_FILTER: ProjectListFilter = {
  query: '',
  projectType: '',
  majorProjectId: '',
  sortKey: 'default',
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
        placeholder="프로젝트 이름 검색"
        aria-label="프로젝트 이름 검색"
        className={`${controlClass} min-w-[200px] flex-1`}
      />
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
          onClick={() => onChange({ ...EMPTY_PROJECT_LIST_FILTER, sortKey: value.sortKey })}
          className="text-xs font-semibold text-brand hover:underline"
        >
          필터 초기화
        </button>
      )}
    </div>
  );
}

export function applyProjectListFilter(
  projects: Project[],
  filter: ProjectListFilter,
): Project[] {
  const query = filter.query.trim().toLowerCase();
  const filtered = projects.filter((project) => {
    if (query && !project.name.toLowerCase().includes(query)) return false;
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
