'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  apiFetch,
  type Project,
  type SubProject,
  type UserBrief,
} from '../../lib/api';

type UseProjectsResult = {
  projects: Project[];
  subprojects: SubProject[];
  users: UserBrief[];
  /** project_id → 시작일 오름차순으로 정렬된 소프로젝트 배열 */
  byProject: Map<number, SubProject[]>;
  loading: boolean;
  error: string;
  reload: () => Promise<void>;
  setError: (msg: string) => void;
};

/**
 * 프로젝트 목록 페이지 전용 데이터 훅.
 * me 가 준비된 뒤 최초 1회 로드되고, mutation 후 reload() 로 강제 갱신한다.
 */
export function useProjects(enabled: boolean): UseProjectsResult {
  const [projects, setProjects] = useState<Project[]>([]);
  const [subprojects, setSubProjects] = useState<SubProject[]>([]);
  const [users, setUsers] = useState<UserBrief[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [ps, sps, us] = await Promise.all([
        apiFetch<Project[]>('/projects'),
        apiFetch<SubProject[]>('/subprojects'),
        apiFetch<UserBrief[]>('/users'),
      ]);
      setProjects(ps);
      setSubProjects(sps);
      setUsers(us);
      setError('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (enabled) void reload();
  }, [enabled, reload]);

  const byProject = useMemo(() => {
    const m = new Map<number, SubProject[]>();
    for (const sp of subprojects) {
      const arr = m.get(sp.project_id) ?? [];
      arr.push(sp);
      m.set(sp.project_id, arr);
    }
    for (const arr of m.values())
      arr.sort((a, b) => a.start_date.localeCompare(b.start_date));
    return m;
  }, [subprojects]);

  return {
    projects,
    subprojects,
    users,
    byProject,
    loading,
    error,
    reload,
    setError,
  };
}
