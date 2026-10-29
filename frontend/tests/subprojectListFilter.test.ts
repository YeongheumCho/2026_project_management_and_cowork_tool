import { describe, expect, it } from 'vitest';
import type { SubProject } from '../app/lib/api';
import {
  applySubProjectFilter,
  EMPTY_SUBPROJECT_FILTER,
  splitCompletedSubprojects,
} from '../app/projects/components/SubProjectListToolbar';

const TODAY = '2026-10-29';

function sp(id: number, status: SubProject['status'], end_date: string, progress = 0): SubProject {
  return { id, name: `sp${id}`, status, end_date, start_date: '2026-10-01', progress } as SubProject;
}

const list = [
  sp(1, 'completed', '2026-10-10', 100),
  sp(2, 'in_progress', '2026-10-20', 40), // 기한 초과
  sp(3, 'in_progress', '2026-11-20', 10),
  sp(4, 'planned', '2026-10-28'), // 기한 초과
  sp(5, 'completed', '2026-12-01', 100),
];

describe('C-15: 기한 초과 필터', () => {
  it('완료 전이고 종료일이 오늘보다 앞선 것만 남긴다', () => {
    const ids = applySubProjectFilter(list, { ...EMPTY_SUBPROJECT_FILTER, status: 'overdue' }, TODAY)
      .map((s) => s.id);
    expect(ids).toEqual([2, 4]);
  });

  it('종료일이 오늘이면 아직 기한 초과가 아니다', () => {
    const ids = applySubProjectFilter([sp(6, 'in_progress', TODAY)], { ...EMPTY_SUBPROJECT_FILTER, status: 'overdue' }, TODAY);
    expect(ids).toEqual([]);
  });
});

describe('C-14: 완료 묶음 나누기', () => {
  it('완료된 것만 따로 빼고 순서는 유지한다', () => {
    const sorted = applySubProjectFilter(list, { sortKey: 'progress_asc', status: '' }, TODAY);
    const { active, completed } = splitCompletedSubprojects(sorted);
    expect(active.map((s) => s.id)).toEqual([4, 3, 2]);
    expect(completed.map((s) => s.id)).toEqual([1, 5]);
  });
});
