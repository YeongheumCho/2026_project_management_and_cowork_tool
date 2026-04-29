import { API_BASE_URL } from '../../lib/api';

/**
 * 백엔드 `/auth/*` 관리자 엔드포인트 전용 타입.
 * 현재 백엔드가 `auth.users` 로 직접 권한 CRUD 를 노출하므로
 * 공용 `lib/api` 의 UserBrief 와 분리해서 유지한다.
 */
export type UserResponse = {
  id: number;
  idnum: string;
  name: string;
  is_active: boolean;
  created_at: string;
  role: string;
  center?: string | null;
  office?: string | null;
  team?: string | null;
  position?: string | null;
  email?: string | null;
  phone?: string | null;
};

export type ErrorResponse = {
  detail?: string;
};

export type UserCreatePayload = {
  idnum: string;
  name: string;
  password: string;
  role: string;
  center?: string | null;
  office?: string | null;
  team?: string | null;
  position?: string | null;
  email?: string | null;
  phone?: string | null;
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
};

type FetchOptions = {
  token: string;
  signal?: AbortSignal;
};

function authHeaders(token: string, withJson = false): HeadersInit {
  const h: HeadersInit = { Authorization: `Bearer ${token}` };
  if (withJson) (h as Record<string, string>)['Content-Type'] = 'application/json';
  return h;
}

export async function fetchMe({ token, signal }: FetchOptions) {
  return fetch(`${API_BASE_URL}/auth/me`, {
    headers: authHeaders(token),
    signal,
  });
}

export async function fetchUsers({ token, signal }: FetchOptions) {
  return fetch(`${API_BASE_URL}/auth/users`, {
    headers: authHeaders(token),
    signal,
  });
}

export async function patchUserRole(
  { token }: FetchOptions,
  idnum: string,
  role: string,
) {
  return fetch(`${API_BASE_URL}/auth/users/${idnum}/role`, {
    method: 'PATCH',
    headers: authHeaders(token, true),
    body: JSON.stringify({ role }),
  });
}

export async function createUser(
  { token }: FetchOptions,
  payload: UserCreatePayload,
) {
  return fetch(`${API_BASE_URL}/auth/users`, {
    method: 'POST',
    headers: authHeaders(token, true),
    body: JSON.stringify(payload),
  });
}

export async function deleteUser(
  { token }: FetchOptions,
  idnum: string,
) {
  return fetch(`${API_BASE_URL}/auth/users/${idnum}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
}

export async function resetUserPassword(
  { token }: FetchOptions,
  idnum: string,
  password: string,
) {
  return fetch(`${API_BASE_URL}/auth/users/${idnum}/password`, {
    method: 'PATCH',
    headers: authHeaders(token, true),
    body: JSON.stringify({ password }),
  });
}

export async function fetchUserProjectHistory(
  { token, signal }: FetchOptions,
  userId: number,
) {
  return fetch(`${API_BASE_URL}/projects/history?user_id=${userId}`, {
    headers: authHeaders(token),
    signal,
  });
}
