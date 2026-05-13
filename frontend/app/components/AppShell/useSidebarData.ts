'use client';

import { useEffect, useState } from 'react';
import { apiFetch, type Project, type SubProject, type UserBrief } from '../../lib/api';

type State = {
  projects: Project[];
  subprojects: SubProject[];
  users: UserBrief[];
  loading: boolean;
};

/**
 * AppShell 좌측 사이드바 전용 데이터 훅.
 *
 * 각 페이지가 자체적으로 projects/users 를 fetch 하므로 이 훅은 그와 별개로
 * shell 최초 마운트 시 한 번만 로드한다. 네트워크 비용이 아깝다면 이후
 * 전역 컨텍스트나 SWR 로 옮길 여지가 있으나, 현 시점에선 단순 병렬 호출이
 * 가장 이해하기 쉽다 — 머지 컨플릭 관점에서도 shell 내부 로컬 상태가 유리.
 */
export function useSidebarData(): State {
  const [projects, setProjects] = useState<Project[]>([]);
  const [subprojects, setSubprojects] = useState<SubProject[]>([]);
  const [users, setUsers] = useState<UserBrief[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [ps, sps, us] = await Promise.all([
          apiFetch<Project[]>('/projects'),
          apiFetch<SubProject[]>('/subprojects'),
          apiFetch<UserBrief[]>('/users'),
        ]);
        if (cancelled) return;
        setProjects(ps);
        setSubprojects(sps);
        setUsers(us);
      } catch {
        // 사이드바는 부가 정보라 실패 시 조용히 빈 목록으로 둔다.
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { projects, subprojects, users, loading };
}
