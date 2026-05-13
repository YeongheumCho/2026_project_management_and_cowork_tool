/**
 * 검증 상태 색상/표시 헬퍼 — 단일 출처
 *
 * - 라벨(VERIFY_STATE_LABEL)과 타입(VerifyState)은 lib/api.ts 에 이미 존재 → 재사용
 * - 본 모듈은 색상(badge/dot)·기본값 처리만 추가
 *
 * backend/app/schemas/project.py 의 VerifyState Literal 과 동기화 필요
 */
import { VERIFY_STATE_LABEL, type VerifyState } from './api';

export type { VerifyState };
export { VERIFY_STATE_LABEL };

/** 의미 분류 — 시맨틱 색상 매핑용 */
type Tone = 'idle' | 'info' | 'warn' | 'fail' | 'pass';

const TONE_BY_STATE: Record<VerifyState, Tone> = {
  not_started: 'idle',
  in_progress: 'info',
  all_pass: 'pass',
  fail_issue: 'fail',
  pass_issue: 'warn',
  review_done: 'pass',
  inreview_waiting: 'idle',
  inreview_in_progress: 'info',
  inreview_done: 'pass',
  uploaded: 'pass',
};

const TONE_BADGE: Record<Tone, string> = {
  idle: 'bg-surface-subtle text-text-muted',
  info: 'bg-blue-100 text-blue-700',
  warn: 'bg-amber-100 text-amber-700',
  fail: 'bg-red-100 text-red-700',
  pass: 'bg-emerald-100 text-emerald-700',
};

const TONE_DOT: Record<Tone, string> = {
  idle: 'bg-slate-400',
  info: 'bg-blue-500',
  warn: 'bg-amber-500',
  fail: 'bg-red-500',
  pass: 'bg-emerald-500',
};

/** 칩 형태 배지 클래스 */
export function verifyStateBadge(state: VerifyState | null | undefined): string {
  if (!state) return TONE_BADGE.idle;
  return TONE_BADGE[TONE_BY_STATE[state]] ?? TONE_BADGE.idle;
}

/** 닷(legend·표식) 클래스 */
export function verifyStateDot(state: VerifyState | null | undefined): string {
  if (!state) return TONE_DOT.idle;
  return TONE_DOT[TONE_BY_STATE[state]] ?? TONE_DOT.idle;
}

/** 한글 라벨 (null/undefined → '-') */
export function verifyStateLabel(state: VerifyState | null | undefined): string {
  if (!state) return '-';
  return VERIFY_STATE_LABEL[state] ?? state;
}

/** select 옵션 매핑 */
export const VERIFY_STATE_OPTIONS: Array<{ value: VerifyState; label: string }> =
  (Object.keys(VERIFY_STATE_LABEL) as VerifyState[]).map((value) => ({
    value,
    label: VERIFY_STATE_LABEL[value],
  }));
