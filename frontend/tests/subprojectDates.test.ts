import { describe, expect, it } from 'vitest';
import { displayEndDate, displayPeriod } from '../app/lib/subprojectDates';

const base = { start_date: '2026-10-28', end_date: '2026-11-02' };

describe('B-104 표시 종료일', () => {
  it('계획보다 일찍 완료하면 완료일까지 그린다', () => {
    const sp = { ...base, status: 'completed' as const, completed_on: '2026-11-01' };
    expect(displayEndDate(sp)).toBe('2026-11-01');
    expect(displayPeriod(sp)).toBe('2026-10-28 ~ 2026-11-01 (완료 · 계획 2026-11-02)');
  });

  it('진행 중이거나 완료일이 없으면 계획 종료일 그대로', () => {
    expect(displayEndDate({ ...base, status: 'in_progress', completed_on: '2026-11-01' })).toBe('2026-11-02');
    expect(displayEndDate({ ...base, status: 'completed', completed_on: null })).toBe('2026-11-02');
  });

  it('계획 종료일 이후에 완료했거나 시작일보다 이른 완료일은 계획 종료일 그대로', () => {
    expect(displayEndDate({ ...base, status: 'completed', completed_on: '2026-11-05' })).toBe('2026-11-02');
    expect(displayEndDate({ ...base, status: 'completed', completed_on: '2026-10-01' })).toBe('2026-11-02');
  });
});
