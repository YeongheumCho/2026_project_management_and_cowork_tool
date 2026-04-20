/**
 * 월 단위 캘린더 계산 유틸.
 *
 * 주 시작은 일요일(0)로 고정. getMonthMatrix()는 6주 x 7열(42칸)의 Date 배열을 돌려준다.
 */
export type DateRange = { start: Date; end: Date };

export function toISODate(d: Date): string {
  // YYYY-MM-DD, 로컬 타임존 기준
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseISODate(s: string): Date {
  const [y, m, d] = s.split('-').map((v) => parseInt(v, 10));
  return new Date(y, m - 1, d);
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function addDays(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

export function addMonths(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setMonth(copy.getMonth() + n);
  return copy;
}

export function getMonthMatrix(year: number, month: number): Date[] {
  // month: 0-indexed
  const firstOfMonth = new Date(year, month, 1);
  const startDayOfWeek = firstOfMonth.getDay(); // 0=Sun
  const start = addDays(firstOfMonth, -startDayOfWeek);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

export function rangeOverlapsDay(range: DateRange, day: Date): boolean {
  const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  const dayEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59);
  return range.start <= dayEnd && range.end >= dayStart;
}

export function formatMonth(year: number, month: number): string {
  return `${year}년 ${month + 1}월`;
}
