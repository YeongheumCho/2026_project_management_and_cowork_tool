/**
 * 사이드바의 프로젝트/팀원 컬러 도트에서 사용할 색상 팔레트.
 * 결정론적 해시로 id → 색을 매핑해 재렌더/재로드 시에도 일관된다.
 */
export const DOT_COLORS = [
  'bg-indigo-500',
  'bg-violet-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-blue-500',
  'bg-rose-500',
  'bg-teal-500',
  'bg-fuchsia-500',
  'bg-sky-500',
  'bg-orange-500',
];

export function colorForId(id: number | string): string {
  const n =
    typeof id === 'number'
      ? id
      : Array.from(id).reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return DOT_COLORS[Math.abs(n) % DOT_COLORS.length];
}
