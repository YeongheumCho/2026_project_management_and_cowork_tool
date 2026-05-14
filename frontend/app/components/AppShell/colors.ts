const COLOR_PALETTE = [
  { dot: 'bg-verify-info-fg', soft: 'bg-verify-info-bg', text: 'text-verify-info-fg' },
  { dot: 'bg-brand', soft: 'bg-brand-soft', text: 'text-brand' },
  { dot: 'bg-verify-pass-fg', soft: 'bg-verify-pass-bg', text: 'text-verify-pass-fg' },
  { dot: 'bg-verify-warn-fg', soft: 'bg-verify-warn-bg', text: 'text-verify-warn-fg' },
  { dot: 'bg-verify-info-fg', soft: 'bg-verify-info-bg', text: 'text-verify-info-fg' },
  { dot: 'bg-verify-fail-fg', soft: 'bg-verify-fail-bg', text: 'text-verify-fail-fg' },
];

// 직급별 고정 색상 — 인턴(회색) → 이사(진홍) 6단계
type ColorEntry = { dot: string; soft: string; text: string };

const POSITION_COLORS: Record<string, ColorEntry> = {
  '인턴':      { dot: 'bg-text-faint', soft: 'bg-surface-muted', text: 'text-text-faint' },
  '전임연구원': { dot: 'bg-verify-info-fg', soft: 'bg-verify-info-bg', text: 'text-verify-info-fg' },
  '선임연구원': { dot: 'bg-verify-pass-fg', soft: 'bg-verify-pass-bg', text: 'text-verify-pass-fg' },
  '책임연구원': { dot: 'bg-brand', soft: 'bg-brand-soft', text: 'text-brand' },
  '수석연구원': { dot: 'bg-verify-warn-fg', soft: 'bg-verify-warn-bg', text: 'text-verify-warn-fg' },
  '이사':      { dot: 'bg-verify-fail-fg', soft: 'bg-verify-fail-bg', text: 'text-verify-fail-fg' },
};

const FALLBACK_COLOR: ColorEntry = { dot: 'bg-text-faint', soft: 'bg-surface-subtle', text: 'text-text-subtle' };

function positionEntry(position: string | null | undefined): ColorEntry {
  if (!position) return FALLBACK_COLOR;
  return POSITION_COLORS[position] ?? FALLBACK_COLOR;
}

export function colorForPosition(position: string | null | undefined): string {
  return positionEntry(position).dot;
}

export function softColorForPosition(position: string | null | undefined): string {
  return positionEntry(position).soft;
}

export function textColorForPosition(position: string | null | undefined): string {
  return positionEntry(position).text;
}

function colorIndex(id: number | string) {
  const seed =
    typeof id === 'number'
      ? id
      : Array.from(id).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return Math.abs(seed) % COLOR_PALETTE.length;
}

export function colorForId(id: number | string): string {
  return COLOR_PALETTE[colorIndex(id)].dot;
}

export function softColorForId(id: number | string): string {
  return COLOR_PALETTE[colorIndex(id)].soft;
}

export function textColorForId(id: number | string): string {
  return COLOR_PALETTE[colorIndex(id)].text;
}
