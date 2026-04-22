'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  fetchMe,
  fetchUsers,
  patchUserRole,
  type ErrorResponse,
  type UserResponse,
} from '../lib/adminApi';

type UseAdminUsersResult = {
  user: UserResponse | null;
  users: UserResponse[];
  loading: boolean;
  savingId: string | null;
  message: string | null;
  setMessage: (msg: string | null) => void;
  handleRoleChange: (idnum: string, role: string) => void;
  handleRoleSave: (member: UserResponse) => Promise<void>;
};

/**
 * 관리자 페이지 데이터 훅.
 *
 * - 마운트 시 `/auth/me`, `/auth/users` 병렬 로드
 * - 401: 토큰 제거 후 로그인으로 리다이렉트
 * - 403: 접근 금지 메시지 노출
 * - 권한 편집은 낙관적 로컬 변경 + 저장 버튼으로 PATCH 요청
 */
export function useAdminUsers(): UseAdminUsersResult {
  const router = useRouter();
  const [user, setUser] = useState<UserResponse | null>(null);
  const [users, setUsers] = useState<UserResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      const token = localStorage.getItem('access_token');
      if (!token) {
        router.replace('/login');
        return;
      }

      try {
        const [meRes, usersRes] = await Promise.all([
          fetchMe({ token }),
          fetchUsers({ token }),
        ]);

        if (meRes.status === 401 || usersRes.status === 401) {
          localStorage.removeItem('access_token');
          router.replace('/login');
          return;
        }

        if (meRes.status === 403 || usersRes.status === 403) {
          setMessage('관리자만 접근할 수 있는 페이지입니다.');
          setLoading(false);
          return;
        }

        if (!meRes.ok || !usersRes.ok) {
          setMessage('관리자 정보를 불러오지 못했습니다.');
          setLoading(false);
          return;
        }

        const [meData, usersData] = await Promise.all([
          meRes.json() as Promise<UserResponse>,
          usersRes.json() as Promise<UserResponse[]>,
        ]);

        setUser(meData);
        setUsers(usersData);
      } catch {
        setMessage('서버와 연결하지 못했습니다.');
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [router]);

  const handleRoleChange = (idnum: string, role: string) => {
    setUsers((prev) =>
      prev.map((m) => (m.idnum === idnum ? { ...m, role } : m)),
    );
  };

  const handleRoleSave = async (member: UserResponse) => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      router.replace('/login');
      return;
    }

    setSavingId(member.idnum);
    setMessage(null);

    try {
      const res = await patchUserRole({ token }, member.idnum, member.role);
      const data = await res.json();

      if (!res.ok) {
        const err = data as ErrorResponse;
        setMessage(err.detail ?? '권한 변경에 실패했습니다.');
        return;
      }

      const updated = data as UserResponse;
      setUsers((prev) =>
        prev.map((m) => (m.idnum === updated.idnum ? updated : m)),
      );
      if (user?.idnum === updated.idnum) setUser(updated);

      setMessage(
        `${updated.name}님의 권한을 ${updated.role}(으)로 변경했습니다.`,
      );
    } catch {
      setMessage('권한 변경 중 오류가 발생했습니다.');
    } finally {
      setSavingId(null);
    }
  };

  return {
    user,
    users,
    loading,
    savingId,
    message,
    setMessage,
    handleRoleChange,
    handleRoleSave,
  };
}
