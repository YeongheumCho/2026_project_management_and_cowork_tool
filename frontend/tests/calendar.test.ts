import { describe, expect, it } from 'vitest';
import { toISODate } from '../app/lib/calendar';

describe('toISODate', () => {
  it('UTC 가 아니라 PC 시간 기준 날짜를 만든다 (오전 9시 전에도 오늘)', () => {
    expect(toISODate(new Date(2026, 9, 16, 0, 30))).toBe('2026-10-16');
    expect(toISODate(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });
});
