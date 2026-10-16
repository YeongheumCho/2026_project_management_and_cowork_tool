'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  apiFetch,
  type MajorProject,
  type Project,
  type SubProject,
  type UserBrief,
} from '../../lib/api';
import { subscribeDataChanged } from '../../lib/dataEvents';

type SidebarData = {
  majorProjects: MajorProject[];
  projects: Project[];
  subprojects: SubProject[];
  users: UserBrief[];
};

// 탭(페이지)을 옮길 때마다 사이드바가 새로 그려지며 네 목록을 다시 받았다.
// 1분 동안은 받은 값을 다시 쓰고, 어디서든 저장이 일어나면(subscribeDataChanged) 바로 버린다.
// 다른 사람의 변경은 최대 1분 늦게 보일 수 있지만, 각 화면 본문은 늘 새로 받는다.
const CACHE_TTL_MS = 60_000;
let cache: { data: SidebarData; at: number; token: string | null } | null = null;

function currentToken(): string | null {
  return typeof window !== 'undefined' ? window.localStorage.getItem('access_token') : null;
}

function freshCache(): SidebarData | null {
  if (!cache || cache.token !== currentToken() || Date.now() - cache.at > CACHE_TTL_MS) return null;
  return cache.data;
}

type State = {
  majorProjects: MajorProject[];
  projects: Project[];
  subprojects: SubProject[];
  users: UserBrief[];
  loading: boolean;
  reload: () => Promise<void>;
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
  // AppShell 은 로그인 정보를 받은 뒤에만 그려지므로 첫 화면부터 기억한 값을 써도 된다.
  const [majorProjects, setMajorProjects] = useState<MajorProject[]>(() => freshCache()?.majorProjects ?? []);
  const [projects, setProjects] = useState<Project[]>(() => freshCache()?.projects ?? []);
  const [subprojects, setSubprojects] = useState<SubProject[]>(() => freshCache()?.subprojects ?? []);
  const [users, setUsers] = useState<UserBrief[]>(() => freshCache()?.users ?? []);
  const [loading, setLoading] = useState(() => freshCache() === null);

  const reload = useCallback(async () => {
    try {
      const [mps, ps, sps, us] = await Promise.all([
        apiFetch<MajorProject[]>('/major-projects'),
        apiFetch<Project[]>('/projects'),
        apiFetch<SubProject[]>('/subprojects'),
        apiFetch<UserBrief[]>('/users'),
      ]);
      setMajorProjects(mps);
      setProjects(ps);
      setSubprojects(sps);
      setUsers(us);
      cache = {
        data: { majorProjects: mps, projects: ps, subprojects: sps, users: us },
        at: Date.now(),
        token: currentToken(),
      };
    } catch {
      // 사이드바는 부가 정보라 실패 시 조용히 빈 목록으로 둔다.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (freshCache()) return;
    void reload();
  }, [reload]);

  // 진행률 기록·하위 프로젝트 수정 등 어떤 페이지에서 데이터가 바뀌어도 사이드바가 따라오도록 한다.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = subscribeDataChanged(() => {
      cache = null;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        void reload();
      }, 300);
    });
    return () => {
      unsubscribe();
      if (timer) clearTimeout(timer);
    };
  }, [reload]);

  return { majorProjects, projects, subprojects, users, loading, reload };
}
