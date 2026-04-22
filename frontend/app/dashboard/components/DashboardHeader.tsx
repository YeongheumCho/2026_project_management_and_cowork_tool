'use client';

type Props = {
  onRequestAiSuggestion?: () => void;
};

/**
 * 개요 페이지 상단 서브헤더 — "팀 대시보드" 제목 + 부제 + AI 추천 버튼.
 *
 * Figma WorkFlow AI 의 개요 탭에 맞춘 스타일.
 */
export default function DashboardHeader({ onRequestAiSuggestion }: Props) {
  const today = new Date();
  const ym = today.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
  });

  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">팀 대시보드</h1>
        <p className="mt-1 text-sm text-slate-500">
          {ym} · 전체 프로젝트 현황
        </p>
      </div>
      {onRequestAiSuggestion && (
        <button
          type="button"
          onClick={onRequestAiSuggestion}
          className="shrink-0 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          AI 업무 추천 받기
        </button>
      )}
    </div>
  );
}
