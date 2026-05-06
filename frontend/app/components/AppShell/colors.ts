const COLOR_PALETTE = [
  { dot: 'bg-[#2563EB]', soft: 'bg-[#EFF6FF]', text: 'text-[#2563EB]' },
  { dot: 'bg-[#534AB7]', soft: 'bg-[#EEEDFE]', text: 'text-[#534AB7]' },
  { dot: 'bg-[#0F6E56]', soft: 'bg-[#E1F5EE]', text: 'text-[#0F6E56]' },
  { dot: 'bg-[#854F0B]', soft: 'bg-[#FAEEDA]', text: 'text-[#854F0B]' },
  { dot: 'bg-[#185FA5]', soft: 'bg-[#E6F1FB]', text: 'text-[#185FA5]' },
  { dot: 'bg-[#993556]', soft: 'bg-[#FBEAF0]', text: 'text-[#993556]' },
];

// 직급별 고정 색상 — 인턴(회색) → 이사(진홍) 6단계
type ColorEntry = { dot: string; soft: string; text: string };

const POSITION_COLORS: Record<string, ColorEntry> = {
  '인턴':      { dot: 'bg-[#8B9CB5]', soft: 'bg-[#F0F3F8]', text: 'text-[#8B9CB5]' },
  '전임연구원': { dot: 'bg-[#2563EB]', soft: 'bg-[#EFF6FF]', text: 'text-[#2563EB]' },
  '선임연구원': { dot: 'bg-[#0F6E56]', soft: 'bg-[#E1F5EE]', text: 'text-[#0F6E56]' },
  '책임연구원': { dot: 'bg-[#534AB7]', soft: 'bg-[#EEEDFE]', text: 'text-[#534AB7]' },
  '수석연구원': { dot: 'bg-[#854F0B]', soft: 'bg-[#FAEEDA]', text: 'text-[#854F0B]' },
  '이사':      { dot: 'bg-[#993556]', soft: 'bg-[#FBEAF0]', text: 'text-[#993556]' },
};

const FALLBACK_COLOR: ColorEntry = { dot: 'bg-[#B4B2A9]', soft: 'bg-[#F4F4F0]', text: 'text-[#888780]' };

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
