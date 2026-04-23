/**
 * Shared API utilities and domain types.
 */
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? '/backend';

export type Role = 'admin' | 'member';

export type UserBrief = {
  id: number;
  idnum: string;
  name: string;
  role: Role;
  is_active?: boolean;
  created_at?: string;
  center?: string | null;
  office?: string | null;
  team?: string | null;
  position?: string | null;
  email?: string | null;
  phone?: string | null;
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

export type VerificationLevel =
  | 'basic'
  | 'LV1'
  | 'LV2'
  | 'BSW'
  | 'LV3'
  | 'LV4';

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

  cr_no?: string | null;
  ip_addr?: string | null;
  change_feedback_min?: number | null;
  change_revalidate_min?: number | null;
  lin_std_hold_note?: string | null;

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
  participants: UserBrief[];
};

export type ProjectMemberTimeSummary = {
  user_id: number;
  user_name: string;
  total_seconds: number;
};

export type ProjectTimeSummary = {
  project_id: number;
  total_seconds: number;
  members: ProjectMemberTimeSummary[];
};

export type WorkQueueItem = {
  id: number;
  project_id: number;
  project_name: string;
  subproject_id: number;
  subproject_name: string;
  start_date: string;
  end_date: string;
  progress: number;
  priority_hint: string;
};

export type WorkLogStatus = 'running' | 'paused' | 'completed';

export type WorkLog = {
  id: number;
  user_id: number;
  subproject_id: number | null;
  task_name: string;
  started_at: string;
  current_started_at: string | null;
  ended_at: string | null;
  duration_sec: number;
  status: WorkLogStatus;
  session_group_id: string | null;
  created_at: string;
};

export type RecommendationRequest = {
  project_name: string;
  project_type: ProjectType | string;
  start_date: string;
  end_date: string;
  office?: string | null;
  team?: string | null;
  availability_weight: number;
  capability_weight: number;
};

export type RecommendationCandidate = {
  user_id: number;
  name: string;
  role: Role | string;
  position?: string | null;
  rank: number;
  score: number;
  availability_score: number;
  capability_score: number;
  remaining_minutes: number;
  keyword_experience_count: number;
  recommendation_source: 'rule' | 'claude' | string;
  reasons: string[];
};

export type RecommendationResponse = {
  request: RecommendationRequest;
  candidates: RecommendationCandidate[];
  claude_used: boolean;
  claude_error: string | null;
};

export type AssignmentRequest = {
  project_name: string;
  project_type: ProjectType | string;
  subproject_name: string;
  assignee_id: number;
  start_date: string;
  end_date: string;
  apply_template: boolean;
};

export type AssignmentResponse = {
  project_id: number;
  subproject_id: number;
  assignee_id: number;
  assigned_member_name: string;
};

export type UserSettings = {
  id: number;
  idnum: string;
  name: string;
  role: Role | string;
  default_calendar_view: 'team' | 'personal';
  notifications_enabled: boolean;
};

export type TemplateTaskItem = {
  name: string;
  weight: number;
};

export type Template = {
  id: number;
  name: string;
  project_type: ProjectType | string;
  trigger_keyword: string | null;
  is_default: boolean;
  tasks: TemplateTaskItem[];
  created_by: number | null;
  created_at: string;
};

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
  review_done: '검토 완료',
  inreview_waiting: 'InReview 대기',
  inreview_in_progress: 'InReview 진행 중',
  inreview_done: 'InReview 완료',
  uploaded: '업로드 완료',
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
