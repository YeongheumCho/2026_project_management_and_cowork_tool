'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  apiFetch,
  type Project,
  type SubProject,
  type UserBrief,
} from '../../lib/api';
import { toISODate } from '../../lib/calendar';

type Summary = {
  inProgressProjects: number;
  completedSubs: number;
  avgProgress: number;
  weeklyMinutes: number;
};

type UseDashboardDataResult = {
  projects: Project[];
  subprojects: SubProject[];
  users: UserBrief[];
  summary: Summary;
  loading: boolean;
  error: string;
  todayIso: string;
  reload: () => Promise<void>;
};

/**
 * Dashboard(개요) 페이지 전용 데이터 훅.
 *
 * - projects/subprojects/users 병렬 로드
 * - 상단 KPI 카드용 요약 값 사전 계산
 *   - inProgressProjects: 진행 중(소프로젝트 하나라도 in_progress/planned) 프로젝트 수
 *   - completedSubs: 완료된 소프로젝트 총 건수
 *   - avgProgress: 소프로젝트 progress 평균 (빈 배열이면 0)
 *   - weeklyMinutes: 현 달 안에 기간이 걸친 소프로젝트들의 total_minutes 합
 *     (백엔드에 별도 주간 집계 API 가 없어 프런트 근사치로 제공)
 */
export function useDashboardData(enabled: boolean): UseDashboardDataResult {
  const [projects, setProjects] = useState<Project[]>([]);
  const [subprojects, setSubProjects] = useState<SubProject[]>([]);
  const [users, setUsers] = useState<UserBrief[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const mountedRef = useRef(false);

  const load = async () => {
    setLoading(true);
    try {
      const [ps, sps, us] = await Promise.allSettled([
        apiFetch<Project[]>('/projects'),
        apiFetch<SubProject[]>('/subprojects'),
        apiFetch<UserBrief[]>('/users'),
      ]);
      if (ps.status !== 'fulfilled') throw ps.reason;
      if (sps.status !== 'fulfilled') throw sps.reason;
      if (!mountedRef.current) return;
      setProjects(ps.value);
      setSubProjects(sps.value);
      setUsers(us.status === 'fulfilled' ? us.value : []);
      setError('');
    } catch (err) {
      if (mountedRef.current) setError((err as Error).message);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    if (!enabled) return;
    mountedRef.current = true;
    void load();
    return () => {
      mountedRef.current = false;
    };
  }, [enabled]);

  const todayIso = toISODate(new Date());

  const summary = useMemo<Summary>(() => {
    // 진행 중 프로젝트: 소프로젝트 중 completed 가 아닌 게 하나라도 있는 프로젝트
    const inProgressProjects = projects.filter(
      (p) =>
        p.subproject_count === 0 ||
        p.completed_subproject_count < p.subproject_count,
    ).length;

    const completedSubs = subprojects.filter(
      (sp) => sp.status === 'completed',
    ).length;

    // 소프로젝트 progress(0–100) 의 단순 평균.
    // 과거에는 "완료된 개수 비율" 로 잘못 계산돼서 세부 태스크 체크로
    // progress 가 20 → 40 → 60 이 올라가도 KPI 카드가 꿈쩍하지 않았다.
    const avgProgress =
      subprojects.length === 0
        ? 0
        : subprojects.reduce((sum, sp) => sum + (sp.progress ?? 0), 0) /
          subprojects.length;

    // 이번 달 기간이 겹치는 소프로젝트의 total_minutes 합.
    const ym = todayIso.slice(0, 7); // "YYYY-MM"
    const weeklyMinutes = subprojects
      .filter(
        (sp) => sp.start_date.startsWith(ym) || sp.end_date.startsWith(ym),
      )
      .reduce((acc, sp) => acc + (sp.total_minutes ?? 0), 0);

    return {
      inProgressProjects,
      completedSubs,
      avgProgress,
      weeklyMinutes,
    };
  }, [projects, subprojects, todayIso]);

  return {
    projects,
    subprojects,
    users,
    summary,
    loading,
    error,
    todayIso,
    reload: () => load(),
  };
}
