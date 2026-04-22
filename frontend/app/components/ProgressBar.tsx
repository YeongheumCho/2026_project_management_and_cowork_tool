'use client';

type Size = 'sm' | 'md';
type Tone = 'brand' | 'progress' | 'done' | 'planned';

interface ProgressBarProps {
  value: number;
  size?: Size;
  tone?: Tone;
  className?: string;
  ariaLabel?: string;
}

const SIZE_TRACK: Record<Size, string> = {
  sm: 'h-1.5',
  md: 'h-2',
};

const TONE_FILL: Record<Tone, string> = {
  brand: 'bg-[#534AB7]',
  progress: 'bg-[#854F0B]',
  done: 'bg-[#3B6D11]',
  planned: 'bg-[#B4B2A9]',
};

export function ProgressBar({
  value,
  size = 'sm',
  tone = 'brand',
  className = '',
  ariaLabel,
}: ProgressBarProps) {
  const safe = Number.isFinite(value) ? value : 0;
  const clamped = Math.max(0, Math.min(100, safe));

  const trackCls = [
    'overflow-hidden rounded-full bg-[#F1EFE8]',
    SIZE_TRACK[size],
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={trackCls}
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={ariaLabel ?? '진척률'}
    >
      <div
        className={`h-full rounded-full transition-all ${TONE_FILL[tone]}`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

export default ProgressBar;
