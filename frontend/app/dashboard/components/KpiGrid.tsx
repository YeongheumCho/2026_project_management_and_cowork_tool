'use client';

import KpiCard from './KpiCard';

type Props = {
  inProgressProjects: number;
  completedSubs: number;
  incompleteSubs: number;
  avgProgress: number;
  loading: boolean;
};

/**
 * 개요 페이지 상단 KPI 4카드 그리드.
 * B-106: 진행 중 프로젝트 / 완료된 업무 / 미완료된 업무 / 평균 진척률
 * (주간 총 작업시간은 프로젝트 탭의 투입 시간과 겹쳐 뺐다)
 */
export default function KpiGrid({
  inProgressProjects,
  completedSubs,
  incompleteSubs,
  avgProgress,
  loading,
}: Props) {
  const avgProgressText = `${Math.round(avgProgress)}%`;

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <KpiCard
        label="진행 중 프로젝트"
        value={String(inProgressProjects)}
        tone="indigo"
        hint="완료되지 않은 하위 프로젝트 포함"
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
        label="미완료된 업무"
        value={String(incompleteSubs)}
        tone="rose"
        hint="아직 완료되지 않은 하위 프로젝트"
        loading={loading}
      />
      <KpiCard
        label="평균 진척률"
        value={avgProgressText}
        tone="amber"
        hint="전체 하위 프로젝트 평균"
        loading={loading}
      />
    </div>
  );
}
