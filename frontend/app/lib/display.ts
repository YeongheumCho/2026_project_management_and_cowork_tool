export function compactPosition(position: string | null | undefined): string {
  return position?.replace(/연구원/g, '').trim() ?? '';
}
