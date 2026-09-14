import type { SubProject } from './api';
import { toISODate } from './calendar';

/**
 * SubProject 상태 매핑 — 단일 출처
 * dashboard, projects, team-calendar, personal-calendar, MonthCalendar 에서 공통 사용
 */
type Status = SubProject['status'];

/** 상태 표시에 필요한 최소 필드 — 캘린더용 임시 객체도 받을 수 있도록 좁게 잡는다. */
export type SubprojectStatusSource = Pick<SubProject, 'status' | 'end_date'>;

export const SUBPROJECT_STATUS_LABEL: Record<Status, string> = {
  planned: '예정',
  in_progress: '진행중',
  completed: '완료',
};

/** 칩(rounded-pill) 형태 배지 — 본문에 임베드 */
export const SUBPROJECT_STATUS_BADGE: Record<Status, string> = {
  planned:     'bg-verify-idle-bg text-verify-idle-fg',
  in_progress: 'bg-verify-info-bg text-verify-info-fg',
  completed:   'bg-verify-pass-bg text-verify-pass-fg',
};

/** 단색 배경(캘린더 일자 셀의 일정 바) */
export const SUBPROJECT_STATUS_BG: Record<Status, string> = {
  planned:     'bg-surface-subtle text-text-muted',
  in_progress: 'bg-verify-info-fg text-white',
  completed:   'bg-verify-pass-fg text-white',
};

/** 닷(legend·간단 표식) */
export const SUBPROJECT_STATUS_DOT: Record<Status, string> = {
  planned:     'bg-text-faint',
  in_progress: 'bg-verify-info-fg',
  completed:   'bg-verify-pass-fg',
};

/** ProgressBar 진행률 색상 */
export const SUBPROJECT_STATUS_BAR: Record<Status, string> = {
  planned:     'bg-surface-subtle',
  in_progress: 'bg-verify-info-fg',
  completed:   'bg-verify-pass-fg',
};

export function getSubprojectStatusLabel(status: Status): string {
  return SUBPROJECT_STATUS_LABEL[status] ?? status;
}

/*
 * 기한 초과 표시
 * 백엔드 status 는 진행률만 보고 정해지므로(완료/진행중/예정) 종료일이 지난 항목도
 * 계속 '예정'(회색)으로 남는다. 화면에서만 종료일을 함께 보고 빨강으로 구분한다.
 * DB 상태 값은 바꾸지 않으므로 내보내기·집계는 그대로다.
 */
export const SUBPROJECT_OVERDUE_LABEL = '기한 초과';
export const SUBPROJECT_OVERDUE_BADGE = 'bg-verify-fail-bg text-verify-fail-fg';
export const SUBPROJECT_OVERDUE_BG = 'bg-verify-fail-fg text-white';
export const SUBPROJECT_OVERDUE_DOT = 'bg-verify-fail-fg';
export const SUBPROJECT_OVERDUE_BAR = 'bg-verify-fail-fg';

/** 오늘 날짜(ISO). 목록을 그릴 때는 한 번 구해서 넘기는 편이 낫다. */
export function todayISODate(): string {
  return toISODate(new Date());
}

/** 완료되지 않았는데 종료일이 이미 지난 상태 */
export function isSubprojectOverdue(
  sp: SubprojectStatusSource,
  todayIso: string = todayISODate(),
): boolean {
  if (sp.status === 'completed') return false;
  if (!sp.end_date) return false;
  return sp.end_date < todayIso;
}

export function subprojectStatusLabel(
  sp: SubprojectStatusSource,
  todayIso?: string,
): string {
  if (isSubprojectOverdue(sp, todayIso)) return SUBPROJECT_OVERDUE_LABEL;
  return getSubprojectStatusLabel(sp.status);
}

export function subprojectBadgeClass(
  sp: SubprojectStatusSource,
  todayIso?: string,
): string {
  if (isSubprojectOverdue(sp, todayIso)) return SUBPROJECT_OVERDUE_BADGE;
  return SUBPROJECT_STATUS_BADGE[sp.status];
}

export function subprojectDotClass(
  sp: SubprojectStatusSource,
  todayIso?: string,
): string {
  if (isSubprojectOverdue(sp, todayIso)) return SUBPROJECT_OVERDUE_DOT;
  return SUBPROJECT_STATUS_DOT[sp.status];
}

export function subprojectBgClass(
  sp: SubprojectStatusSource,
  todayIso?: string,
): string {
  if (isSubprojectOverdue(sp, todayIso)) return SUBPROJECT_OVERDUE_BG;
  return SUBPROJECT_STATUS_BG[sp.status];
}

export function subprojectBarClass(
  sp: SubprojectStatusSource,
  todayIso?: string,
): string {
  if (isSubprojectOverdue(sp, todayIso)) return SUBPROJECT_OVERDUE_BAR;
  return SUBPROJECT_STATUS_BAR[sp.status];
}
