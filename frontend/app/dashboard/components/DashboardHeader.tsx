'use client';

export default function DashboardHeader() {
  const today = new Date();
  const ym = today.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
  });

  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-xl font-bold tracking-[-0.3px] text-[#1A1A1A]">
          팀 대시보드
        </h1>
        <p className="mt-1 text-small text-[#888780]">
          {ym} 전체 프로젝트 현황
        </p>
      </div>
    </div>
  );
}
