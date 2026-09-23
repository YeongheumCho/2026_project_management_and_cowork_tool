'use client';

import type { SubProject } from '../../lib/api';

/**
 * B-92: 하위 프로젝트 목록 정렬·필터.
 *
 * 프로젝트 목록 툴바(ProjectListToolbar)와 같은 모양을 쓰되,
 * 프로젝트 카드 안에 들어가므로 더 작게 잡았다.
 */

export type SubProjectSortKey =
  | 'default'
  | 'name_asc'
  | 'name_desc'
  | 'progress_desc'
  | 'progress_asc';

export type SubProjectStatusFilter = '' | 'in_progress' | 'completed' | 'planned';

export type SubProjectListFilter = {
  sortKey: SubProjectSortKey;
  status: SubProjectStatusFilter;
};

export const EMPTY_SUBPROJECT_FILTER: SubProjectListFilter = {
  sortKey: 'default',
  status: '',
};

const SORT_LABEL: Record<SubProjectSortKey, string> = {
  default: '기본 순서',
  name_asc: '이름 오름차순',
  name_desc: '이름 내림차순',
  progress_desc: '진행률 높은 순',
  progress_asc: '진행률 낮은 순',
};

const STATUS_LABEL: Record<SubProjectStatusFilter, string> = {
  '': '전체 상태',
  in_progress: '진행중',
  completed: '진행 완료',
  planned: '미진행',
};

const controlClass =
  'h-8 rounded-lg border border-border bg-white px-2 text-micro text-text outline-none transition focus:border-brand';

/** 필터와 정렬을 적용한 목록을 돌려준다. 원본은 건드리지 않는다. */
export function applySubProjectFilter(
  subprojects: SubProject[],
  filter: SubProjectListFilter,
): SubProject[] {
  const filtered = filter.status
    ? subprojects.filter((sp) => sp.status === filter.status)
    : subprojects;

  if (filter.sortKey === 'default') return filtered;

  const sorted = filtered.slice();
  switch (filter.sortKey) {
    case 'name_asc':
      sorted.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
      break;
    case 'name_desc':
      sorted.sort((a, b) => b.name.localeCompare(a.name, 'ko'));
      break;
    case 'progress_desc':
      sorted.sort((a, b) => b.progress - a.progress);
      break;
    case 'progress_asc':
      sorted.sort((a, b) => a.progress - b.progress);
      break;
  }
  return sorted;
}

type Props = {
  value: SubProjectListFilter;
  onChange: (next: SubProjectListFilter) => void;
  total: number;
  visible: number;
};

export default function SubProjectListToolbar({
  value,
  onChange,
  total,
  visible,
}: Props) {
  const changed =
    value.sortKey !== EMPTY_SUBPROJECT_FILTER.sortKey ||
    value.status !== EMPTY_SUBPROJECT_FILTER.status;

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <select
        value={value.status}
        onChange={(event) =>
          onChange({
            ...value,
            status: event.target.value as SubProjectStatusFilter,
          })
        }
        className={controlClass}
        aria-label="하위 프로젝트 상태 필터"
      >
        {(Object.keys(STATUS_LABEL) as SubProjectStatusFilter[]).map((key) => (
          <option key={key} value={key}>
            {STATUS_LABEL[key]}
          </option>
        ))}
      </select>

      <select
        value={value.sortKey}
        onChange={(event) =>
          onChange({
            ...value,
            sortKey: event.target.value as SubProjectSortKey,
          })
        }
        className={controlClass}
        aria-label="하위 프로젝트 정렬"
      >
        {(Object.keys(SORT_LABEL) as SubProjectSortKey[]).map((key) => (
          <option key={key} value={key}>
            {SORT_LABEL[key]}
          </option>
        ))}
      </select>

      {changed && (
        <button
          type="button"
          onClick={() => onChange(EMPTY_SUBPROJECT_FILTER)}
          className="h-8 rounded-lg border border-border bg-white px-2.5 text-micro font-semibold text-text-muted transition hover:bg-surface-muted"
        >
          초기화
        </button>
      )}

      <span className="ml-auto text-micro text-text-subtle">
        {visible}/{total}건
      </span>
    </div>
  );
}
