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

export function useAdminUsers(enabled = true): UseAdminUsersResult {
  const router = useRouter();
  const [user, setUser] = useState<UserResponse | null>(null);
  const [users, setUsers] = useState<UserResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setUser(null);
      setUsers([]);
      setSavingId(null);
      setMessage(null);
      setLoading(false);
      return;
    }

    const run = async () => {
      setLoading(true);
      setMessage(null);

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
          setMessage('관리자만 접근할 수 있는 기능입니다.');
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
        setMessage('서버에 연결하지 못했습니다.');
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [enabled, router]);

  const handleRoleChange = (idnum: string, role: string) => {
    setUsers((prev) =>
      prev.map((member) => (member.idnum === idnum ? { ...member, role } : member)),
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
        prev.map((current) =>
          current.idnum === updated.idnum ? updated : current,
        ),
      );
      if (user?.idnum === updated.idnum) setUser(updated);

      setMessage(`${updated.name}의 권한을 ${updated.role}(으)로 변경했습니다.`);
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
