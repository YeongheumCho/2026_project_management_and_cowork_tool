import type { SubProject } from './api';

/**
 * SubProject 상태 매핑 — 단일 출처
 * dashboard, projects, team-calendar, personal-calendar, MonthCalendar 에서 공통 사용
 */
type Status = SubProject['status'];

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
