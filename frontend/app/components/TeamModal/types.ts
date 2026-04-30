import type {
  EtcCategory,
  SubProject,
  VerificationLevel,
  VerifyState,
} from '../../lib/api';

/**
 * TeamModal 내부 폼 상태.
 * 백엔드 스키마(SubProjectCreate/Update)와 1:1로 대응되지만,
 * input value 바인딩 편의를 위해 모든 숫자/enum 필드를 문자열로 보관한다.
 */
export type FormState = {
  projectId: number | '';
  name: string;
  assigneeId: number | '';
  assigneeIds: number[];
  startDate: string;
  endDate: string;

  priority: string;
  controllerName: string;
  controllerVersion: string;
  controllerCountry: string;
  toNumber: string;
  toAssignee: string;
  verificationLevel: VerificationLevel | '';
  vehicleType: string;
  functionName: string;
  functionOwner: string;
  verifierId: number | '';
  reviewerId: number | '';
  seatNo: string;
  controllerNo: string;
  avgExpectedMinutes: string;
  issueNote: string;
  uploadDone: boolean;
  specialNote: string;
  completedOn: string;

  firstVerifyStatus: VerifyState | '';
  firstSetupMin: string;
  firstAudMin: string;
  firstReviewMin: string;

  inreviewStatus: VerifyState | '';
  inreviewSetupMin: string;
  inreviewAudMin: string;
  inreviewFeedbackMin: string;

  crNo: string;
  ipAddr: string;
  changeFeedbackMin: string;
  changeRevalidateMin: string;
  linStdHoldNote: string;

  etcCategory: EtcCategory | '';
  etcMonth: string;
  etcDays: string;
  etcNote: string;

  // 커스텀 필드 (프로젝트 유형별 동적 필드)
  customFields: Record<string, string>;
};

export const EMPTY_FORM: FormState = {
  projectId: '',
  name: '',
  assigneeId: '',
  assigneeIds: [],
  startDate: '',
  endDate: '',
  priority: '',
  controllerName: '',
  controllerVersion: '',
  controllerCountry: '',
  toNumber: '',
  toAssignee: '',
  verificationLevel: '',
  vehicleType: '',
  functionName: '',
  functionOwner: '',
  verifierId: '',
  reviewerId: '',
  seatNo: '',
  controllerNo: '',
  avgExpectedMinutes: '',
  issueNote: '',
  uploadDone: false,
  specialNote: '',
  completedOn: '',
  firstVerifyStatus: '',
  firstSetupMin: '',
  firstAudMin: '',
  firstReviewMin: '',
  inreviewStatus: '',
  inreviewSetupMin: '',
  inreviewAudMin: '',
  inreviewFeedbackMin: '',
  crNo: '',
  ipAddr: '',
  changeFeedbackMin: '',
  changeRevalidateMin: '',
  linStdHoldNote: '',
  etcCategory: '',
  etcMonth: '',
  etcDays: '',
  etcNote: '',
  customFields: {},
};

export function fromSubProject(sp: SubProject): FormState {
  return {
    projectId: sp.project_id,
    name: sp.name,
    assigneeId: sp.assignee_id ?? sp.assignee_ids?.[0] ?? '',
    assigneeIds: sp.assignee_ids?.length
      ? sp.assignee_ids
      : sp.assignee_id == null
        ? []
        : [sp.assignee_id],
    startDate: sp.start_date,
    endDate: sp.end_date,
    priority: sp.priority ?? '',
    controllerName: sp.controller_name ?? '',
    controllerVersion: sp.controller_version ?? '',
    controllerCountry: sp.controller_country ?? '',
    toNumber: sp.to_number ?? '',
    toAssignee: sp.to_assignee ?? '',
    verificationLevel: (sp.verification_level ?? '') as VerificationLevel | '',
    vehicleType: sp.vehicle_type ?? '',
    functionName: sp.function_name ?? '',
    functionOwner: sp.function_owner ?? '',
    verifierId: sp.verifier_id ?? '',
    reviewerId: sp.reviewer_id ?? '',
    seatNo: sp.seat_no ?? '',
    controllerNo: sp.controller_no ?? '',
    avgExpectedMinutes:
      sp.avg_expected_minutes != null ? String(sp.avg_expected_minutes) : '',
    issueNote: sp.issue_note ?? '',
    uploadDone: !!sp.upload_done,
    specialNote: sp.special_note ?? '',
    completedOn: sp.completed_on ?? '',
    firstVerifyStatus: (sp.first_verify_status ?? '') as VerifyState | '',
    firstSetupMin: sp.first_setup_min != null ? String(sp.first_setup_min) : '',
    firstAudMin: sp.first_aud_min != null ? String(sp.first_aud_min) : '',
    firstReviewMin:
      sp.first_review_min != null ? String(sp.first_review_min) : '',
    inreviewStatus: (sp.inreview_status ?? '') as VerifyState | '',
    inreviewSetupMin:
      sp.inreview_setup_min != null ? String(sp.inreview_setup_min) : '',
    inreviewAudMin: sp.inreview_aud_min != null ? String(sp.inreview_aud_min) : '',
    inreviewFeedbackMin:
      sp.inreview_feedback_min != null ? String(sp.inreview_feedback_min) : '',
    crNo: sp.cr_no ?? '',
    ipAddr: sp.ip_addr ?? '',
    changeFeedbackMin:
      sp.change_feedback_min != null ? String(sp.change_feedback_min) : '',
    changeRevalidateMin:
      sp.change_revalidate_min != null ? String(sp.change_revalidate_min) : '',
    linStdHoldNote: sp.lin_std_hold_note ?? '',
    etcCategory: (sp.etc_category ?? '') as EtcCategory | '',
    etcMonth: sp.etc_month ?? '',
    etcDays: sp.etc_days != null ? String(sp.etc_days) : '',
    etcNote: sp.etc_note ?? '',
    customFields: sp.custom_fields
      ? Object.fromEntries(
          Object.entries(sp.custom_fields).map(([k, v]) => [k, String(v ?? '')])
        )
      : {},
  };
}

export function numOrUndef(s: string): number | undefined {
  if (s === '' || s == null) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

export function strOrNull(s: string): string | null {
  return s.trim() === '' ? null : s;
}

/** 상태 setter 래퍼 타입 — 각 Section 컴포넌트가 공통으로 사용 */
export type FormSetter = <K extends keyof FormState>(
  key: K,
  value: FormState[K],
) => void;
