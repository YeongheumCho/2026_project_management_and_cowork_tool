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
  brand: 'bg-brand',
  progress: 'bg-verify-warn-fg',
  done: 'bg-verify-pass-fg',
  planned: 'bg-text-faint',
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
    'overflow-hidden rounded-full bg-surface-subtle',
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
