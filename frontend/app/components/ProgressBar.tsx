'use client';

type Size = 'sm' | 'md';
type Tone = 'brand' | 'progress' | 'done' | 'planned';

interface ProgressBarProps {
  /** 진척도 0~100. 범위 밖 값은 자동으로 보정됨. */
  value: number;
  /** 막대 두께. sm = h-1.5 (목록), md = h-2 (모달). 기본 sm. */
  size?: Size;
  /** 색상 톤. 기본 brand(파랑). */
  tone?: Tone;
  /** 추가 클래스. */
  className?: string;
  /** 스크린리더용 라벨. 기본 "진척도". */
  ariaLabel?: string;
}

const SIZE_TRACK: Record<Size, string> = {
  sm: 'h-1.5',
  md: 'h-2',
};

const TONE_FILL: Record<Tone, string> = {
  brand: 'bg-blue-500',
  progress: 'bg-amber-500',
  done: 'bg-emerald-500',
  planned: 'bg-slate-400',
};

/**
 * 진척도(0~100)를 시각화하는 가로 막대.
 * SubProject 진척도 표시는 모두 이 컴포넌트로 통일한다.
 *
 * 사용 예:
 *   <ProgressBar value={sp.progress} />              // 목록
 *   <ProgressBar value={sp.progress} size="md" />    // 모달
 */
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
    'overflow-hidden rounded-full bg-slate-200',
    SIZE_TRACK[size],
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const fillCls = ['h-full transition-all', TONE_FILL[tone]].join(' ');

  return (
    <div
      className={trackCls}
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={ariaLabel ?? '진척도'}
    >
      <div className={fillCls} style={{ width: `${clamped}%` }} />
    </div>
  );
}

export default ProgressBar;
