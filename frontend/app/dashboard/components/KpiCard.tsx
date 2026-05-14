'use client';

type Props = {
  label: string;
  value: string;
  hint?: string;
  tone?: 'indigo' | 'emerald' | 'amber' | 'rose' | 'slate';
  loading?: boolean;
};

const TONE: Record<NonNullable<Props['tone']>, string> = {
  indigo: 'text-brand',
  emerald: 'text-verify-pass-fg',
  amber: 'text-verify-warn-fg',
  rose: 'text-verify-info-fg',
  slate: 'text-text',
};

export default function KpiCard({
  label,
  value,
  hint,
  tone = 'indigo',
  loading,
}: Props) {
  return (
    <div className="rounded-xl border border-border bg-white px-[18px] py-4 shadow-sm">
      <p className="text-nano font-bold uppercase tracking-[0.8px] text-text-subtle">
        {label}
      </p>
      <p className={`mt-2 text-[26px] font-bold leading-none ${TONE[tone]}`}>
        {loading ? '--' : value}
      </p>
      {hint && <p className="mt-[5px] text-tiny text-text-subtle">{hint}</p>}
    </div>
  );
}
