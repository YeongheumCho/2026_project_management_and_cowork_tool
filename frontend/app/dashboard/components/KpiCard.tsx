'use client';

type Props = {
  label: string;
  value: string;
  hint?: string;
  /** 값에 사용할 색상 토큰 */
  tone?: 'indigo' | 'emerald' | 'amber' | 'rose' | 'slate';
  loading?: boolean;
};

const TONE: Record<NonNullable<Props['tone']>, string> = {
  indigo: 'text-indigo-600',
  emerald: 'text-emerald-600',
  amber: 'text-amber-600',
  rose: 'text-rose-600',
  slate: 'text-slate-700',
};

/**
 * Dashboard 상단 KPI 카드 (Figma "개요" 4-up 카드 기준).
 *
 * value 는 숫자가 아닌 "63%", "89h" 같이 단위를 포함한 문자열로 받아
 * 카드 별로 포맷을 분리하지 않고 호출부에서 책임지게 한다.
 */
export default function KpiCard({
  label,
  value,
  hint,
  tone = 'indigo',
  loading,
}: Props) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className={`mt-2 text-3xl font-bold ${TONE[tone]}`}>
        {loading ? '—' : value}
      </p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}
