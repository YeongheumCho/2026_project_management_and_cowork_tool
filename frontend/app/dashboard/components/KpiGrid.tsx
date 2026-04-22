'use client';

import KpiCard from './KpiCard';

type Props = {
  inProgressProjects: number;
  completedSubs: number;
  avgProgress: number;
  weeklyMinutes: number;
  memberCount: number;
  loading: boolean;
};

/**
 * 개요 페이지 상단 KPI 4카드 그리드.
 * Figma "개요" 탭 기준 순서: 진행 중 프로젝트 / 완료된 업무 / 평균 진척률 / 주간 총 작업시간
 */
export default function KpiGrid({
  inProgressProjects,
  completedSubs,
  avgProgress,
  weeklyMinutes,
  memberCount,
  loading,
}: Props) {
  const avgProgressText = `${Math.round(avgProgress)}%`;
  const weeklyHours = Math.round((weeklyMinutes / 60) * 10) / 10;
  const perMemberHours =
    memberCount > 0
      ? Math.round((weeklyHours / memberCount) * 10) / 10
      : weeklyHours;

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <KpiCard
        label="진행 중 프로젝트"
        value={String(inProgressProjects)}
        tone="indigo"
        hint="완료되지 않은 소프로젝트 포함"
        loading={loading}
      />
      <KpiCard
        label="완료된 업무"
        value={String(completedSubs)}
        tone="emerald"
        hint="전체 누적 기준"
        loading={loading}
      />
      <KpiCard
        label="평균 진척률"
        value={avgProgressText}
        tone="amber"
        hint="전체 소프로젝트 평균"
        loading={loading}
      />
      <KpiCard
        label="주간 총 작업시간"
        value={`${weeklyHours}h`}
        tone="rose"
        hint={memberCount > 0 ? `팀원 1인당 ${perMemberHours}h` : '팀원 미등록'}
        loading={loading}
      />
    </div>
  );
}
