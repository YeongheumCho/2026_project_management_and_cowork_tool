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
  const [majorProjects, setMajorProjects] = useState<MajorProject[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [subprojects, setSubprojects] = useState<SubProject[]>([]);
  const [users, setUsers] = useState<UserBrief[]>([]);
  const [loading, setLoading] = useState(true);

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
    } catch {
      // 사이드바는 부가 정보라 실패 시 조용히 빈 목록으로 둔다.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  // 진행률 기록·하위 프로젝트 수정 등 어떤 페이지에서 데이터가 바뀌어도 사이드바가 따라오도록 한다.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = subscribeDataChanged(() => {
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
