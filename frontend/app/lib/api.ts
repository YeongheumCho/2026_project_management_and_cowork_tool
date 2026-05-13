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
  assignee_ids: number[];
  assignees: { id: number; name: string }[];
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

  custom_fields?: Record<string, unknown> | null;
};

export type Project = {
  id: number;
  name: string;
  project_type: ProjectType | string;
  start_date?: string | null;
  end_date?: string | null;
  created_by: number | null;
  created_at: string;
  participants: UserBrief[];
  progress_percent: number;
  subproject_count: number;
  completed_subproject_count: number;
  in_progress_subproject_count: number;
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
  project_id: number;
  project_name: string;
  subproject_id: number;
  subproject_name: string;
  project_type: string;
  role_in_project: string;
  started_on: string | null;
  ended_on: string | null;
  worked_minutes: number;
  completion_rate: number;
  recorded_at: string;
  manual_override: boolean;
};

export type ProjectHistoryUpdate = {
  subproject_name?: string;
  started_on?: string | null;
  ended_on?: string | null;
  worked_minutes?: number;
  keyword_text?: string | null;
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
  history_experience_count: number;
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

export type FieldType =
  | 'text'
  | 'number'
  | 'date'
  | 'select'
  | 'textarea'
  | 'checkbox';

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
};

export type ProjectFieldSchema = {
  id: number;
  project_type: ProjectType | string;
  section_label: string;
  fields: FieldDefinition[];
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

const verifyStateOptions = Object.entries(VERIFY_STATE_LABEL).map(
  ([value, label]) => ({ value, label }),
);
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
  field(13, 'seat_no', '검증 자리'),
  field(14, 'controller_no', '제어기 번호'),
  field(15, 'avg_expected_minutes', '평균 예상 소요(분)', 'number'),
  field(16, 'first_verify_status', '1차 검증 상태', 'select', verifyStateOptions),
  field(17, 'first_setup_min', '1차 Setup(분)', 'number'),
  field(18, 'first_aud_min', '1차 AUD(분)', 'number'),
  field(19, 'first_review_min', '1차 Review(분)', 'number'),
  field(20, 'inreview_status', 'InReview 상태', 'select', verifyStateOptions),
  field(21, 'inreview_setup_min', 'InReview Setup(분)', 'number'),
  field(22, 'inreview_aud_min', 'InReview AUD(분)', 'number'),
  field(23, 'inreview_feedback_min', 'InReview 반영(분)', 'number'),
  field(24, 'upload_done', '업로드 완료', 'checkbox'),
  field(25, 'special_note', '특이사항', 'textarea'),
  field(26, 'issue_note', '이슈 / 진행 상황', 'textarea'),
];

export const DEFAULT_PROJECT_FIELD_SCHEMAS: Record<string, ProjectFieldSchema> = {
  general: {
    id: 0,
    project_type: 'general',
    section_label: '추가 정보',
    fields: [],
    created_by: null,
    updated_at: '',
  },
  official_inspection: {
    id: 0,
    project_type: 'official_inspection',
    section_label: '공식 검증 정보',
    fields: inspectionFields,
    created_by: null,
    updated_at: '',
  },
  regular_inspection: {
    id: 0,
    project_type: 'regular_inspection',
    section_label: '검증 정보',
    fields: inspectionFields.filter((item) => item.key !== 'priority'),
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
    created_by: null,
    updated_at: new Date().toISOString(),
  };
}

export function defaultFieldSchema(project_type: string): ProjectFieldSchema {
  return DEFAULT_PROJECT_FIELD_SCHEMAS[project_type] ?? emptyFieldSchema(project_type);
}

export function effectiveFieldSchema(schema: ProjectFieldSchema): ProjectFieldSchema {
  if (schema.id !== 0 || schema.fields.length > 0) return schema;
  return defaultFieldSchema(schema.project_type);
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
  return body as T;
}
