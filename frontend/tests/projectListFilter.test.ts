import { describe, expect, it } from 'vitest';
import type { Project } from '../app/lib/api';
import {
  applyProjectListFilter,
  EMPTY_PROJECT_LIST_FILTER,
  matchSubprojectsByQuery,
} from '../app/projects/components/ProjectListToolbar';

function project(id: number, name: string): Project {
  return { id, name, project_type: 'general', major_project_id: 1 } as Project;
}

const projects = [project(1, 'A 프로젝트'), project(2, 'B 프로젝트'), project(3, '일감 모음')];
const subs = new Map([
  [1, [{ name: '일감1' }, { name: '일감2' }]],
  [2, [{ name: 'TSTRGR' }]],
]);

function ids(query: string, queryScope: 'all' | 'project' | 'subproject') {
  return applyProjectListFilter(
    projects,
    { ...EMPTY_PROJECT_LIST_FILTER, query, queryScope },
    subs,
  ).map((item) => item.id);
}

describe('B-108: 하위 프로젝트 이름으로 프로젝트 찾기', () => {
  it('전체: 프로젝트 이름이나 하위 프로젝트 이름 어느 쪽이든 맞으면 나온다', () => {
    expect(ids('일감', 'all')).toEqual([1, 3]);
    expect(ids('tstrgr', 'all')).toEqual([2]);
  });

  it('프로젝트: 프로젝트 이름만 본다', () => {
    expect(ids('일감', 'project')).toEqual([3]);
  });

  it('하위 프로젝트: 하위 프로젝트 이름만 본다', () => {
    expect(ids('일감', 'subproject')).toEqual([1]);
    expect(ids('프로젝트', 'subproject')).toEqual([]);
  });

  it('검색어가 비면 모두 나오고, 맞는 하위 프로젝트 목록은 비어 있다', () => {
    expect(ids('  ', 'subproject')).toEqual([1, 2, 3]);
    expect(matchSubprojectsByQuery(subs.get(1) ?? [], '')).toEqual([]);
    expect(matchSubprojectsByQuery(subs.get(1) ?? [], '일감1')).toEqual([{ name: '일감1' }]);
  });
});
