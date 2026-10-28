import type { SubProject } from './api';

type DatedSubProject = Pick<SubProject, 'start_date' | 'end_date' | 'status'> & {
  completed_on?: string | null;
};

/**
 * B-104: 화면에 그릴 종료일.
 * 계획 종료일보다 먼저 완료했으면 실제 완료일까지만 그린다.
 * 계획 종료일(end_date)은 DB 에 그대로 두어 "계획보다 며칠 일찍 끝났는지"를 잃지 않는다.
 */
export function displayEndDate(sp: DatedSubProject): string {
  if (
    sp.status === 'completed' &&
    sp.completed_on &&
    sp.completed_on >= sp.start_date &&
    sp.completed_on < sp.end_date
  ) {
    return sp.completed_on;
  }
  return sp.end_date;
}

/** "시작일 ~ 종료일" 문구. 일찍 끝났으면 계획 종료일을 함께 적는다. */
export function displayPeriod(sp: DatedSubProject): string {
  const end = displayEndDate(sp);
  if (end !== sp.end_date) return `${sp.start_date} ~ ${end} (완료 · 계획 ${sp.end_date})`;
  return `${sp.start_date} ~ ${sp.end_date}`;
}
