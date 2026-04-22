'use client';

type Props = {
  label: string;
  value: string;
  hint?: string;
  tone?: 'indigo' | 'emerald' | 'amber' | 'rose' | 'slate';
  loading?: boolean;
};

const TONE: Record<NonNullable<Props['tone']>, string> = {
  indigo: 'text-[#534AB7]',
  emerald: 'text-[#3B6D11]',
  amber: 'text-[#854F0B]',
  rose: 'text-[#185FA5]',
  slate: 'text-[#1A1A1A]',
};

export default function KpiCard({
  label,
  value,
  hint,
  tone = 'indigo',
  loading,
}: Props) {
  return (
    <div className="rounded-xl border border-[#EAEAE4] bg-white px-[18px] py-4 shadow-sm">
      <p className="text-[9px] font-bold uppercase tracking-[0.8px] text-[#888780]">
        {label}
      </p>
      <p className={`mt-2 text-[26px] font-bold leading-none ${TONE[tone]}`}>
        {loading ? '--' : value}
      </p>
      {hint && <p className="mt-[5px] text-[10px] text-[#888780]">{hint}</p>}
    </div>
  );
}
