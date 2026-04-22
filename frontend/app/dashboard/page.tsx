'use client';

import { useMemo } from 'react';
import AppShell from '../components/AppShell';
import { useMe } from '../lib/useMe';
import DashboardHeader from './components/DashboardHeader';
import KpiGrid from './components/KpiGrid';
import ProjectList from './components/ProjectList';
import TimerWidget from './components/TimerWidget';
import { useDashboardData } from './hooks/useDashboardData';

/**
 * 개요(대시보드) 페이지.
 *
 * 이 파일은 오케스트레이션만 담당한다 — 데이터 로딩/KPI 집계는
 * `hooks/useDashboardData`, UI 블록은 `components/` 하위 파일로 분리되어 있어
 * 팀원별 동시 작업 시 충돌이 최소화된다.
 *
 * Figma "개요" 탭 구조:
 * 상단 서브헤더 → KPI 4카드 → 타이머 위젯 → 프로젝트 목록
 */
export default function DashboardPage() {
  const { me, loading: meLoading } = useMe();
  const enabled = !!me;
  const {
    projects,
    subprojects,
    users,
    summary,
    loading,
    error,
    todayIso,
  } = useDashboardData(enabled);

  // 타이머 위젯용 — 내가 담당한, 오늘 기간이 걸쳐 있는 소프로젝트
  const myActive = useMemo(() => {
    if (!me) return [];
    return subprojects.filter(
      (sp) =>
        sp.assignee_id === me.id &&
        sp.start_date <= todayIso &&
        sp.end_date >= todayIso &&
        sp.status !== 'completed',
    );
  }, [subprojects, me, todayIso]);

  if (meLoading || !me) {
    return <main className="p-8 text-slate-900">불러오는 중...</main>;
  }

  return (
    <AppShell me={me}>
      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      <DashboardHeader />

      <KpiGrid
        inProgressProjects={summary.inProgressProjects}
        completedSubs={summary.completedSubs}
        avgProgress={summary.avgProgress}
        weeklyMinutes={summary.weeklyMinutes}
        memberCount={users.length}
        loading={loading}
      />

      <TimerWidget candidates={myActive} />

      <ProjectList
        projects={projects}
        subprojects={subprojects}
        loading={loading}
      />
    </AppShell>
  );
}
