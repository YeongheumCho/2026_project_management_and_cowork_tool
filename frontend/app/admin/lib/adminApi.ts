import { API_BASE_URL } from '../../lib/api';

/**
 * 백엔드 `/auth/*` 관리자 엔드포인트 전용 타입.
 * 현재 백엔드가 `auth.users` 로 직접 권한 CRUD 를 노출하므로
 * 공용 `lib/api` 의 UserBrief 와 분리해서 유지한다.
 */
export type UserResponse = {
  idnum: string;
  name: string;
  is_active: boolean;
  created_at: string;
  role: string;
};

export type ErrorResponse = {
  detail?: string;
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
