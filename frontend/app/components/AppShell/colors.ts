const COLOR_PALETTE = [
  { dot: 'bg-[#2563EB]', soft: 'bg-[#EFF6FF]', text: 'text-[#2563EB]' },
  { dot: 'bg-[#534AB7]', soft: 'bg-[#EEEDFE]', text: 'text-[#534AB7]' },
  { dot: 'bg-[#0F6E56]', soft: 'bg-[#E1F5EE]', text: 'text-[#0F6E56]' },
  { dot: 'bg-[#854F0B]', soft: 'bg-[#FAEEDA]', text: 'text-[#854F0B]' },
  { dot: 'bg-[#185FA5]', soft: 'bg-[#E6F1FB]', text: 'text-[#185FA5]' },
  { dot: 'bg-[#993556]', soft: 'bg-[#FBEAF0]', text: 'text-[#993556]' },
];

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
