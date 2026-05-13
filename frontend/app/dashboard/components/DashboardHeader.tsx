'use client';

type Props = {
  onRequestAiSuggestion?: () => void;
};

export default function DashboardHeader({ onRequestAiSuggestion }: Props) {
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
          {ym} · 전체 프로젝트 현황
        </p>
      </div>
      {onRequestAiSuggestion && (
        <button
          type="button"
          onClick={onRequestAiSuggestion}
          className="shrink-0 rounded-lg border border-[#D3D1C7] bg-white px-[14px] py-[7px] text-small font-bold text-[#534AB7] hover:bg-[#F8F8F5]"
        >
          AI 업무 추천 받기
        </button>
      )}
    </div>
  );
}
