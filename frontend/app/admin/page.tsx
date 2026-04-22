'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { API_BASE_URL } from '../lib/api';
import { useEffect, useState } from 'react';


type UserResponse = {
  idnum: string;
  name: string;
  is_active: boolean;
  created_at: string;
  role: string;
};

type ErrorResponse = {
  detail?: string;
};

export default function AdminPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserResponse | null>(null);
  const [users, setUsers] = useState<UserResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchAdminData = async () => {
      const token = localStorage.getItem('access_token');

      if (!token) {
        router.replace('/login');
        return;
      }

      try {
        const [meRes, usersRes] = await Promise.all([
          fetch(`${API_BASE_URL}/auth/me`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),
          fetch(`${API_BASE_URL}/auth/users`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),
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

    void fetchAdminData();
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    router.push('/login');
  };

  const handleRoleChange = (idnum: string, role: string) => {
    setUsers((currentUsers) =>
      currentUsers.map((member) =>
        member.idnum === idnum ? { ...member, role } : member,
      ),
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
      const res = await fetch(`${API_BASE_URL}/auth/users/${member.idnum}/role`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ role: member.role }),
      });

      const data = await res.json();

      if (!res.ok) {
        const errorData = data as ErrorResponse;
        setMessage(errorData.detail ?? '권한 변경에 실패했습니다.');
        return;
      }

      const updatedUser = data as UserResponse;

      setUsers((currentUsers) =>
        currentUsers.map((currentMember) =>
          currentMember.idnum === updatedUser.idnum ? updatedUser : currentMember,
        ),
      );

      if (user?.idnum === updatedUser.idnum) {
        setUser(updatedUser);
      }

      setMessage(`${updatedUser.name}님의 권한을 ${updatedUser.role}(으)로 변경했습니다.`);
    } catch {
      setMessage('권한 변경 중 오류가 발생했습니다.');
    } finally {
      setSavingId(null);
    }
  };

  if (loading) {
    return <main className="p-8 text-slate-900">불러오는 중...</main>;
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <div className="flex min-h-screen">
        <aside className="w-64 border-r border-slate-200 bg-white p-6">
          <h1 className="text-2xl font-bold text-blue-600">KPI Tool</h1>
          <p className="mt-2 text-sm text-slate-400">협업 툴 관리자 화면</p>

          <nav className="mt-8 space-y-2">
            <Link href="/dashboard" className="block rounded-xl px-4 py-3 text-sm hover:bg-blue-50">
              대시보드
            </Link>
            <Link href="/projects" className="block rounded-xl px-4 py-3 text-sm hover:bg-blue-50">
              프로젝트 목록
            </Link>
            <Link href="/tasks" className="block rounded-xl px-4 py-3 text-sm hover:bg-blue-50">
              할 일
            </Link>
            <Link href="/team" className="block rounded-xl px-4 py-3 text-sm hover:bg-blue-50">
              조직도
            </Link>
            <Link href="/admin" className="block rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-700">
              관리자
            </Link>
          </nav>
        </aside>

        <section className="flex-1 p-8">
          <header className="flex items-center justify-between border-b border-slate-200 pb-6">
            <div>
              <h2 className="text-3xl font-bold text-green-600">EM_Center 업무 추천 시스템</h2>
              <p className="mt-2 text-sm text-slate-500">
                관리자 페이지입니다. 팀원 목록과 권한을 관리할 수 있습니다.
              </p>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm">{user?.name}</p>
                <p className="text-xs text-slate-500">{user?.idnum}</p>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm hover:bg-slate-100"
              >
                로그아웃
              </button>
            </div>
          </header>

          <div className="mt-8 grid gap-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold">팀원 목록</h3>
                <span className="text-sm text-slate-500">총 {users.length}명</span>
              </div>

              {message && (
                <p className="mt-4 rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-700">
                  {message}
                </p>
              )}

              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b text-slate-500">
                    <tr>
                      <th className="py-2">이름</th>
                      <th className="py-2">사번</th>
                      <th className="py-2">권한</th>
                      <th className="py-2">상태</th>
                      <th className="py-2">저장</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((member) => (
                      <tr key={member.idnum} className="border-b hover:bg-slate-50">
                        <td className="py-3 font-medium">{member.name}</td>
                        <td className="py-3">{member.idnum}</td>
                        <td className="py-3">
                          <select
                            value={member.role}
                            onChange={(event) => handleRoleChange(member.idnum, event.target.value)}
                            disabled={savingId === member.idnum || user?.role !== 'admin'}
                            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                          >
                            <option value="user">user</option>
                            <option value="admin">admin</option>
                          </select>
                        </td>
                        <td className="py-3">
                          {member.is_active ? (
                            <span className="rounded-full bg-green-100 px-2 py-1 text-xs text-green-700">
                              활성
                            </span>
                          ) : (
                            <span className="rounded-full bg-slate-200 px-2 py-1 text-xs text-slate-600">
                              비활성
                            </span>
                          )}
                        </td>
                        <td className="py-3">
                          <button
                            type="button"
                            onClick={() => void handleRoleSave(member)}
                            disabled={savingId === member.idnum || user?.role !== 'admin'}
                            className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                          >
                            {savingId === member.idnum ? '저장 중...' : '저장'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {users.length === 0 && (
                  <p className="py-6 text-center text-sm text-slate-500">등록된 사용자가 없습니다.</p>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
