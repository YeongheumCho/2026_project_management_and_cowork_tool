/**
 * 공통 API 유틸 + 도메인 타입.
 */
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? '/backend';

export type UserBrief = {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'member';
};

export type Me = UserBrief & {
  is_active: boolean;
  created_at: string;
};

export type SubTask = {
  id: number;
  name: string;
  order_index: number;
  weight: number;
  is_done: boolean;
  done_at: string | null;
};

export type ProjectType =
  | 'general'
  | 'official_inspection'
  | 'regular_inspection'
  | 'change_inspection'
  | 'etc_task';

export type VerifyState =
  | 'not_started'
  | 'in_progress'
  | 'all_pass'
  | 'fail_issue'
  | 'pass_issue'
  | 'review_done'
  | 'inreview_waiting'
  | 'inreview_in_progress'
  | 'inreview_done'
  | 'uploaded';

export type VerificationLevel = 'basic' | 'LV1' | 'LV2' | 'BSW' | 'LV3' | 'LV4';

export type EtcCategory =
  | 'education'
  | 'vacation'
  | 'business_trip'
  | 'fail_classification'
  | 'other';

export type SubProject = {
  id: number;
  project_id: number;
  name: string;
  assignee_id: number | null;
  assignee: { id: number; name: string } | null;
  start_date: string;
  end_date: string;
  status: 'planned' | 'in_progress' | 'completed';
  progress: number;
  subtasks: SubTask[];
  created_at: string;
  updated_at: string;

  // KEFICO 공통 메타
  priority?: string | null;
  controller_name?: string | null;
  controller_version?: string | null;
  controller_country?: string | null;
  to_number?: string | null;
  to_assignee?: string | null;
  verification_level?: VerificationLevel | null;
  vehicle_type?: string | null;
  function_name?: string | null;
  function_owner?: string | null;
  verifier_id?: number | null;
  verifier?: { id: number; name: string } | null;
  reviewer_id?: number | null;
  reviewer?: { id: number; name: string } | null;
  seat_no?: string | null;
  controller_no?: string | null;
  avg_expected_minutes?: number | null;
  issue_note?: string | null;
  upload_done?: boolean;
  special_note?: string | null;
  completed_on?: string | null;

  // 1차 / InReview 상태·시간
  first_verify_status?: VerifyState | null;
  first_setup_min?: number | null;
  first_aud_min?: number | null;
  first_review_min?: number | null;
  first_total_min?: number;

  inreview_status?: VerifyState | null;
  inreview_setup_min?: number | null;
  inreview_aud_min?: number | null;
  inreview_feedback_min?: number | null;
  inreview_total_min?: number;

  total_minutes?: number;

  // 변경점 검증 전용
  cr_no?: string | null;
  ip_addr?: string | null;
  change_feedback_min?: number | null;
  change_revalidate_min?: number | null;
  lin_std_hold_note?: string | null;

  // 기타 업무 전용
  etc_category?: EtcCategory | null;
  etc_month?: string | null;
  etc_days?: number | null;
  etc_note?: string | null;
};

export type Project = {
  id: number;
  name: string;
  project_type: ProjectType | string;
  created_by: number | null;
  created_at: string;
};

// ---------- 한국어 라벨 ----------

export const PROJECT_TYPE_LABEL: Record<string, string> = {
  general: '일반',
  official_inspection: '공식 검증',
  regular_inspection: '정기 검증',
  change_inspection: '변경점 검증',
  etc_task: '기타 업무',
};

export const VERIFY_STATE_LABEL: Record<VerifyState, string> = {
  not_started: '대기',
  in_progress: '검증 중',
  all_pass: '올패스 완료',
  fail_issue: 'FAIL 이슈',
  pass_issue: 'PASS 이슈',
  review_done: '검토 완(담당자 재확인)',
  inreview_waiting: 'InReview 대기',
  inreview_in_progress: 'InReview 진행 중',
  inreview_done: 'InReview 완료',
  uploaded: '업로드 완',
};

export const VERIFICATION_LEVEL_LABEL: Record<VerificationLevel, string> = {
  basic: '기초',
  LV1: 'LV1',
  LV2: 'LV2',
  BSW: 'BSW',
  LV3: 'LV3',
  LV4: 'LV4',
};

export const ETC_CATEGORY_LABEL: Record<EtcCategory, string> = {
  education: '직급별 교육',
  vacation: '개인 휴가',
  business_trip: '개인 출장',
  fail_classification: 'FAIL 유형 분류',
  other: '기타',
};

// ---------- fetch util ----------

type ErrorBody = {
  detail?: string | Array<{ msg: string }>;
};

function extractErrorMessage(body: ErrorBody | null, fallback: string) {
  if (!body) return fallback;
  if (typeof body.detail === 'string') return body.detail;
  if (Array.isArray(body.detail)) return body.detail.map((d) => d.msg).join(', ');
  return fallback;
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token =
    typeof window !== 'undefined'
      ? window.localStorage.getItem('access_token')
      : null;

  const headers = new Headers(init.headers);
  if (!(init.body instanceof FormData) && init.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });

  if (res.status === 204) {
    return undefined as unknown as T;
  }

  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
  }

  if (!res.ok) {
    throw new Error(
      extractErrorMessage(body as ErrorBody, `요청 실패 (${res.status})`),
    );
  }
  return body as T;
}
