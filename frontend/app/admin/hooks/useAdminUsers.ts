'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  createUser,
  deleteUser,
  fetchMe,
  fetchUsers,
  patchUserRole,
  type ErrorResponse,
  type UserCreatePayload,
  type UserResponse,
} from '../lib/adminApi';

type UseAdminUsersResult = {
  user: UserResponse | null;
  users: UserResponse[];
  loading: boolean;
  savingId: string | null;
  deletingId: string | null;
  message: string | null;
  setMessage: (msg: string | null) => void;
  handleRoleChange: (idnum: string, role: string) => void;
  handleRoleSave: (member: UserResponse) => Promise<void>;
  handleUserCreate: (payload: UserCreatePayload) => Promise<boolean>;
  handleUserDelete: (member: UserResponse) => Promise<void>;
};

export function useAdminUsers(enabled = true): UseAdminUsersResult {
  const router = useRouter();
  const [user, setUser] = useState<UserResponse | null>(null);
  const [users, setUsers] = useState<UserResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setUser(null);
      setUsers([]);
      setSavingId(null);
      setDeletingId(null);
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

  const handleUserCreate = async (payload: UserCreatePayload) => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      router.replace('/login');
      return false;
    }

    setMessage(null);

    try {
      const res = await createUser({ token }, payload);
      const data = await res.json();

      if (!res.ok) {
        const err = data as ErrorResponse;
        setMessage(err.detail ?? '사용자 추가에 실패했습니다.');
        return false;
      }

      const created = data as UserResponse;
      setUsers((prev) =>
        [...prev, created].sort((left, right) =>
          `${left.name}-${left.idnum}`.localeCompare(`${right.name}-${right.idnum}`, 'ko'),
        ),
      );
      setMessage(`${created.name}님 계정을 추가했습니다.`);
      return true;
    } catch {
      setMessage('사용자 추가 중 오류가 발생했습니다.');
      return false;
    }
  };

  const handleUserDelete = async (member: UserResponse) => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      router.replace('/login');
      return;
    }

    setDeletingId(member.idnum);
    setMessage(null);

    try {
      const res = await deleteUser({ token }, member.idnum);
      if (!res.ok) {
        let detail = '사용자 삭제에 실패했습니다.';
        try {
          const err = (await res.json()) as ErrorResponse;
          detail = err.detail ?? detail;
        } catch {}
        setMessage(detail);
        return;
      }

      setUsers((prev) => prev.filter((current) => current.idnum !== member.idnum));
      setMessage(`${member.name}님 계정을 삭제했습니다.`);
    } catch {
      setMessage('사용자 삭제 중 오류가 발생했습니다.');
    } finally {
      setDeletingId(null);
    }
  };

  return {
    user,
    users,
    loading,
    savingId,
    deletingId,
    message,
    setMessage,
    handleRoleChange,
    handleRoleSave,
    handleUserCreate,
    handleUserDelete,
  };
}
