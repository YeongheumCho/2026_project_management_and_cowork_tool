/**
 * Shared API utilities and domain types.
 */
import { notifyDataChanged } from './dataEvents';

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

export type ProjectType = string;

export const PROJECT_TYPE_OPTIONS: ProjectType[] = [
  'official_inspection',
  'regular_inspection',
  'change_inspection',
  'etc_task',
  'general',
];

export type VerifyState =
  | 'not_started'
  | 'in_progress'
  | 'review_waiting'
  | 'review_in_progress'
  | 'all_pass'
  | 'fail_issue'
  | 'pass_issue'
  | 'review_done'
  | 'inreview_waiting'
  | 'inreview_in_progress'
  | 'inreview_done'
  | 'uploaded';

// B-26: 1차 검증 칸과 InReview 칸이 서로 다른 목록을 쓴다.
// 예전에는 하나의 목록을 공유해서 InReview 칸에 'FAIL 이슈' 같은 값이 함께 떴다.
export const FIRST_VERIFY_STATES: VerifyState[] = [
  'not_started',
  'in_progress',
  'review_waiting',
  'review_in_progress',
  'review_done',
  'all_pass',
  'fail_issue',
  'pass_issue',
];

export const INREVIEW_STATES: VerifyState[] = [
  'inreview_waiting',
  'inreview_in_progress',
  'inreview_done',
  'uploaded',
];

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
  assignee_ids: number[];
  assignees: { id: number; name: string }[];
  start_date: string;
  end_date: string;
  status: 'planned' | 'in_progress' | 'completed';
  progress: number;
  subtasks: SubTask[];
  created_by?: number | null;
  created_by_name?: string | null;
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
  function_owner?: number | null;
  verifier_id?: number | null;
  verifier?: { id: number; name: string } | null;
  verifier_ids?: number[];
  verifiers?: { id: number; name: string }[];
  reviewer_id?: number | null;
  reviewer?: { id: number; name: string } | null;
  reviewer_ids?: number[];
  reviewers?: { id: number; name: string }[];
  inreviewer_id?: number | null;
  inreviewer?: { id: number; name: string } | null;
  inreviewer_ids?: number[];
  inreviewers?: { id: number; name: string }[];
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

  weight?: number | null;

  custom_fields?: Record<string, unknown> | null;
};

export type Project = {
  id: number;
  major_project_id?: number | null;
  major_project?: MajorProjectBrief | null;
  name: string;
  project_type: ProjectType | string;
  start_date?: string | null;
  end_date?: string | null;
  vehicle_sets: ProjectVehicleSet[];
  created_by: number | null;
  created_at: string;
  participants: UserBrief[];
  progress_percent: number;
  subproject_count: number;
  completed_subproject_count: number;
  in_progress_subproject_count: number;
};

export type ProjectVehicleSet = {
  controller_name: string;
  vehicle_type: string;
  controller_country: string;
  controller_version: string;
};

export type MajorProjectBrief = {
  id: number;
  name: string;
  start_date?: string | null;
  end_date?: string | null;
  kickoff_date?: string | null;
  project_types: string[];
  is_default: boolean;
};

export type MajorProject = MajorProjectBrief & {
  members: UserBrief[];
  project_count: number;
  created_at: string;
};

export type ProgressLog = {
  id: number;
  project_id: number;
  subproject_id: number | null;
  user_id: number;
  user_name?: string | null;
  progress_percent: number;
  comment: string | null;
  work_date: string;
  created_at: string;
};

export type ProgressContribution = {
  user_id: number;
  user_name: string;
  is_assignee: boolean;
  latest_percent: number | null;
  work_date: string | null;
  contributed_percent: number;
};

export type SubProjectProgressSummary = {
  subproject_id: number;
  progress: number;
  owner_count: number;
  share_percent: number;
  contributions: ProgressContribution[];
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

export type ProjectHistoryEntry = {
  id: number;
  user_id: number;
  user_name: string;
  major_project_id?: number | null;
  major_project_name?: string | null;
  project_id: number | null;
  project_name: string;
  subproject_id: number | null;
  subproject_name: string;
  project_type: string;
  role_in_project: string;
  started_on: string | null;
  ended_on: string | null;
  worked_minutes: number;
  completion_rate: number;
  recorded_at: string;
  manual_override: boolean;
  /** B-82: 이 이력이 어떤 검증 단계에 얼마를 썼는지. 기록이 없으면 빈 목록. */
  stage_breakdown?: HistoryStageMinutes[];
};

export type HistoryStageMinutes = {
  stage: TimeEntryStage;
  stage_label: string;
  minutes: number;
};

// ── 담당자별 검증 시간 (B-73 / B-74) ──────────────────────────────
export type TimeEntryStage = 'first_verify' | 'inreview' | 'change';
export type TimeEntryRole = 'verifier' | 'reviewer' | 'inreviewer' | 'assignee';

export const TIME_ENTRY_STAGES: TimeEntryStage[] = [
  'first_verify',
  'inreview',
  'change',
];

export const TIME_ENTRY_STAGE_LABEL: Record<TimeEntryStage, string> = {
  first_verify: '1차 검증',
  inreview: 'InReview',
  change: '변경점 검증',
};

export const TIME_ENTRY_ROLE_LABEL: Record<TimeEntryRole, string> = {
  verifier: '검증',
  reviewer: '리뷰',
  inreviewer: 'InReview',
  assignee: '기능 담당',
};

/** 단계별 소요 시간 칸 이름 — 변경점 검증은 AUD 가 없다. */
export const TIME_ENTRY_FIELD_LABEL: Record<
  TimeEntryStage,
  { setup: string; aud: string | null; work: string }
> = {
  first_verify: { setup: '세팅(분)', aud: 'AUD(분)', work: 'Review 작성·재검증(분)' },
  inreview: { setup: '세팅(분)', aud: 'AUD(분)', work: '코디 피드백 반영(분)' },
  change: { setup: '세팅(분)', aud: null, work: '검토·재검증(분)' },
};

export type SubProjectTimeEntry = {
  id: number;
  subproject_id: number;
  user_id: number;
  user_name?: string | null;
  stage: TimeEntryStage;
  role: TimeEntryRole;
  setup_min?: number | null;
  aud_min?: number | null;
  work_min?: number | null;
  total_min: number;
  state?: VerifyState | null;
  issue_note?: string | null;
  worked_on?: string | null;
  updated_at: string;
};

export type TimeEntryStageTotal = {
  stage: TimeEntryStage;
  stage_label: string;
  total_min: number;
  person_count: number;
  /** 담당자별 기록이 없어 기존 칸 값을 그대로 쓰고 있는 단계 */
  from_legacy: boolean;
};

export type SubProjectTimeSummary = {
  subproject_id: number;
  total_min: number;
  stages: TimeEntryStageTotal[];
  entries: SubProjectTimeEntry[];
};

export type SubProjectTimeEntryUpsert = {
  stage: TimeEntryStage;
  role: TimeEntryRole;
  setup_min?: number | null;
  aud_min?: number | null;
  work_min?: number | null;
  state?: VerifyState | null;
  issue_note?: string | null;
  worked_on?: string | null;
  user_id?: number | null;
};

export type ProjectHistoryUpdate = {
  subproject_name?: string;
  started_on?: string | null;
  ended_on?: string | null;
  worked_minutes?: number;
  keyword_text?: string | null;
};

export type ProjectHistoryCreate = {
  user_id: number;
  project_id?: number | null;
  project_name?: string;
  project_type?: string;
  subproject_id?: number | null;
  subproject_name: string;
  started_on?: string | null;
  ended_on?: string | null;
  worked_minutes: number;
  completion_rate?: number;
  keyword_text?: string | null;
};

export type WorkLogUserSummary = {
  user_id: number;
  user_name: string;
  center?: string | null;
  office?: string | null;
  team?: string | null;
  total_seconds: number;
  running_seconds: number;
  paused_seconds: number;
  completed_seconds: number;
  log_count: number;
  running_count: number;
  last_task_name: string | null;
  last_logged_at: string | null;
};

export type ProjectHistoryMemberSummary = {
  user_id: number;
  user_name: string;
  completed_count: number;
  total_minutes: number;
  last_completed_on: string | null;
};

export type ProjectHistorySummary = {
  project_id: number;
  total_completed_count: number;
  members: ProjectHistoryMemberSummary[];
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
  project_id?: number | null;
  subproject_id?: number | null;
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
  average_history_minutes: number | null;
  history_time_score: number;
  history_time_sample_count: number;
  project_relevance_score: number;
  project_relevance_evidence: string[];
  keyword_experience_count: number;
  history_experience_count: number;
  recommendation_source: 'rule' | 'claude' | string;
  reasons: string[];
};

export type RecommendationResponse = {
  request: RecommendationRequest;
  candidates: RecommendationCandidate[];
  clarifying_questions: string[];
  claude_used: boolean;
  claude_error: string | null;
};

export type AssignmentRequest = {
  project_id?: number | null;
  subproject_id?: number | null;
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

export type FieldType =
  | 'text'
  | 'number'
  | 'date'
  | 'select'
  | 'textarea'
  | 'checkbox'
  | 'members';

export type FieldOption = {
  label: string;
  value: string;
};

export type FieldDefinition = {
  key: string;
  label: string;
  field_type: FieldType;
  options: FieldOption[];
  required: boolean;
  order: number;
  default_value?: string | null;
};

export type ProjectFieldSchema = {
  id: number;
  project_type: ProjectType | string;
  section_label: string;
  fields: FieldDefinition[];
  weight: number;
  created_by: number | null;
  updated_at: string;
};

export const PROJECT_TYPE_LABEL: Record<string, string> = {
  general: '일반',
  official_inspection: '공식 검증',
  regular_inspection: '정기 검증',
  change_inspection: '변경점 검증',
  etc_task: '기타 업무',
};

export const VERIFY_STATE_LABEL: Record<VerifyState, string> = {
  not_started: '검증 전',
  in_progress: '검증 중',
  review_waiting: '리뷰 전',
  review_in_progress: '리뷰 중',
  review_done: '검증 완료',
  all_pass: '전체 완료',
  fail_issue: 'FAIL 이슈',
  pass_issue: 'PASS 이슈',
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

const firstVerifyStateOptions = FIRST_VERIFY_STATES.map((value) => ({
  value,
  label: VERIFY_STATE_LABEL[value],
}));
const inreviewStateOptions = INREVIEW_STATES.map((value) => ({
  value,
  label: VERIFY_STATE_LABEL[value],
}));
const verificationLevelOptions = Object.entries(VERIFICATION_LEVEL_LABEL).map(
  ([value, label]) => ({ value, label }),
);
const etcCategoryOptions = Object.entries(ETC_CATEGORY_LABEL).map(
  ([value, label]) => ({ value, label }),
);

function field(
  order: number,
  key: string,
  label: string,
  field_type: FieldType = 'text',
  options: FieldOption[] = [],
): FieldDefinition {
  return { key, label, field_type, options, required: false, order };
}

const inspectionFields: FieldDefinition[] = [
  field(0, 'priority', '우선순위'),
  field(1, 'controller_name', '제어기명'),
  field(2, 'controller_version', '버전 정보'),
  field(3, 'controller_country', '국가'),
  field(4, 'to_number', 'TO 번호'),
  field(5, 'to_assignee', 'TO 담당자'),
  field(6, 'verification_level', '검증 LEVEL', 'select', verificationLevelOptions),
  field(7, 'vehicle_type', '차종'),
  field(8, 'completed_on', '완료일', 'date'),
  field(9, 'function_name', '기능명'),
  field(10, 'function_owner', '기능 담당자', 'select'),
  field(11, 'verifier_id', '검증 담당자', 'select'),
  field(12, 'reviewer_id', '리뷰 담당자', 'select'),
  field(13, 'inreviewer_id', 'InReview 담당자', 'select'),
  field(14, 'seat_no', '검증 자리'),
  field(15, 'controller_no', '제어기 번호'),
  field(16, 'avg_expected_minutes', '평균 예상 소요(분)', 'number'),
  field(17, 'first_verify_status', '1차 검증 상태', 'select', firstVerifyStateOptions),
  field(18, 'first_setup_min', '1차 Setup(분)', 'number'),
  field(19, 'first_aud_min', '1차 AUD(분)', 'number'),
  field(20, 'first_review_min', '1차 Review(분)', 'number'),
  field(21, 'inreview_status', 'InReview 상태', 'select', inreviewStateOptions),
  field(22, 'inreview_setup_min', 'InReview Setup(분)', 'number'),
  field(23, 'inreview_aud_min', 'InReview AUD(분)', 'number'),
  field(24, 'inreview_feedback_min', 'InReview 반영(분)', 'number'),
  field(25, 'upload_done', '업로드 완료', 'checkbox'),
  field(26, 'special_note', '특이사항', 'textarea'),
  field(27, 'issue_note', '이슈 / 진행 상황', 'textarea'),
];

export const DEFAULT_PROJECT_FIELD_SCHEMAS: Record<string, ProjectFieldSchema> = {
  general: {
    id: 0,
    project_type: 'general',
    section_label: '추가 정보',
    fields: [],
    weight: 5,
    created_by: null,
    updated_at: '',
  },
  official_inspection: {
    id: 0,
    project_type: 'official_inspection',
    section_label: '공식 검증 정보',
    fields: inspectionFields,
    weight: 5,
    created_by: null,
    updated_at: '',
  },
  regular_inspection: {
    id: 0,
    project_type: 'regular_inspection',
    section_label: '검증 정보',
    fields: inspectionFields.filter((item) => item.key !== 'priority'),
    weight: 5,
    created_by: null,
    updated_at: '',
  },
  change_inspection: {
    id: 0,
    project_type: 'change_inspection',
    section_label: '변경점 검증 정보',
    fields: [
      ...inspectionFields.filter((item) => item.key !== 'priority'),
      field(100, 'cr_no', 'CR.No'),
      field(101, 'ip_addr', 'IP'),
      field(102, 'change_feedback_min', '검토 피드백(분)', 'number'),
      field(103, 'change_revalidate_min', '재검증(분)', 'number'),
      field(104, 'lin_std_hold_note', 'LIN/STD/HOLD/FAIL 메모', 'textarea'),
    ].map((item, order) => ({ ...item, order })),
    weight: 5,
    created_by: null,
    updated_at: '',
  },
  etc_task: {
    id: 0,
    project_type: 'etc_task',
    section_label: '기타 업무 정보',
    fields: [
      field(0, 'etc_category', '카테고리', 'select', etcCategoryOptions),
      field(1, 'etc_month', '월(YYYY-MM)'),
      field(2, 'etc_days', '소요일(DAY)', 'number'),
      field(3, 'etc_note', '비고 / 상세', 'textarea'),
    ],
    weight: 5,
    created_by: null,
    updated_at: '',
  },
};
export function emptyFieldSchema(project_type: string): ProjectFieldSchema {
  return {
    id: 0,
    project_type,
    section_label: '추가 정보',
    fields: [],
    weight: 5,
    created_by: null,
    updated_at: new Date().toISOString(),
  };
}

export function defaultFieldSchema(project_type: string): ProjectFieldSchema {
  return DEFAULT_PROJECT_FIELD_SCHEMAS[project_type] ?? emptyFieldSchema(project_type);
}

export function effectiveFieldSchema(schema: ProjectFieldSchema): ProjectFieldSchema {
  if (schema.id !== 0 || schema.fields.length > 0) return schema;
  // 대프로젝트/프로젝트 템플릿 키는 내장 기본 스키마("추가 정보")로 대체하지 않는다.
  return DEFAULT_PROJECT_FIELD_SCHEMAS[String(schema.project_type)] ?? schema;
}

export type Template = {
  id: number;
  name: string;
  project_type: ProjectType | string;
  trigger_keyword: string | null;
  is_default: boolean;
  fields: Record<string, unknown>;
  created_by: number | null;
  created_at: string;
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
  if (!isReadOnlyMethod(init.method)) notifyDataChanged();
  return body as T;
}

function isReadOnlyMethod(method: string | undefined) {
  const normalized = (method ?? 'GET').toUpperCase();
  return normalized === 'GET' || normalized === 'HEAD';
}

