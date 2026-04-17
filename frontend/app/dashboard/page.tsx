'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const API_BASE_URL = 'http://127.0.0.1:8000';

type MeResponse = {
  id: number;
  email: string;
  name: string;
  is_active: boolean;
  created_at: string;
};

type Project = {
  id: number;
  name: string;
  description: string | null;
  created_by: number;
  created_at: string;
};

function getErrorMessage(data: any, defaultMessage: string) {
  if (!data) return defaultMessage;

  if (typeof data.detail === 'string') {
    return data.detail;
  }

  if (Array.isArray(data.detail)) {
    return data.detail.map((item: any) => item.msg).join(', ');
  }

  return defaultMessage;
}

export default function DashboardPage() {
  const router = useRouter();

  const [user, setUser] = useState<MeResponse | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');

  const getToken = () => localStorage.getItem('access_token');

  const fetchMe = async () => {
    const token = getToken();

    if (!token) {
      router.replace('/login');
      return;
    }

    const res = await fetch(`${API_BASE_URL}/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await res.json();

    if (!res.ok) {
      localStorage.removeItem('access_token');
      router.replace('/login');
      return;
    }

    setUser(data);
  };

  const fetchProjects = async () => {
    const token = getToken();

    if (!token) {
      router.replace('/login');
      return;
    }

    const res = await fetch(`${API_BASE_URL}/projects`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await res.json();

    if (!res.ok) {
      setMessage(getErrorMessage(data, '프로젝트 목록을 불러오지 못했습니다.'));
      return;
    }

    setProjects(data);
  };

  useEffect(() => {
    const init = async () => {
      try {
        await fetchMe();
        await fetchProjects();
      } catch (error) {
        localStorage.removeItem('access_token');
        router.replace('/login');
      } finally {
        setLoading(false);
      }
    };

    void init();
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    router.push('/login');
  };

  const handleCreateProject = async (e: FormEvent) => {
    e.preventDefault();
    setMessage('');

    try {
      const token = getToken();

      if (!token) {
        router.replace('/login');
        return;
      }

      const res = await fetch(`${API_BASE_URL}/projects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: projectName,
          description: projectDescription || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(getErrorMessage(data, '프로젝트 생성에 실패했습니다.'));
        return;
      }

      setMessage('프로젝트가 생성되었습니다.');
      setProjectName('');
      setProjectDescription('');

      await fetchProjects();
    } catch (error) {
      setMessage(`프로젝트 생성 실패: ${String(error)}`);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 p-8 text-slate-900">
        불러오는 중...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <div className="flex min-h-screen">
        <aside className="w-64 border-r border-slate-200 bg-white p-6">
          <h1 className="text-2xl font-bold text-blue-600">KPI Tool</h1>
          <p className="mt-2 text-sm text-slate-400">협업 툴 관리자 화면</p>

          <nav className="mt-8 space-y-2">
            <Link
              href="/dashboard"
              className="block rounded-xl px-4 py-3 text-sm hover:bg-blue-50"
            >
              대시보드
            </Link>
            <Link
              href="/projects"
              className="block rounded-xl px-4 py-3 text-sm hover:bg-blue-50"
            >
              프로젝트
            </Link>
            <Link
              href="/tasks"
              className="block rounded-xl px-4 py-3 text-sm hover:bg-blue-50"
            >
              할 일
            </Link>
            <Link
              href="/team"
              className="block rounded-xl px-4 py-3 text-sm hover:bg-blue-50"
            >
              팀 관리
            </Link>
          </nav>
        </aside>

        <section className="flex-1 p-8">
          <header className="flex items-center justify-between border-b border-slate-200 pb-6">
            <div>
              <h2 className="text-3xl font-bold">대시보드</h2>
              <p className="mt-2 text-sm text-slate-500">
                프로젝트를 생성하고 진행 상황을 관리하는 공간
              </p>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm">{user?.name}</p>
                <p className="text-xs text-slate-500">{user?.email}</p>
              </div>
              <button
                onClick={handleLogout}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm hover:bg-slate-100"
              >
                로그아웃
              </button>
            </div>
          </header>

          {message && (
            <div className="mt-6 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
              {message}
            </div>
          )}

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-xl font-semibold">프로젝트 생성</h3>
              <p className="mt-2 text-sm text-slate-500">
                새로운 프로젝트를 만들고 진행 기록을 남길 수 있습니다.
              </p>

              <form onSubmit={handleCreateProject} className="mt-4 space-y-4">
                <input
                  type="text"
                  placeholder="프로젝트 이름"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
                  required
                />

                <textarea
                  placeholder="프로젝트 설명"
                  value={projectDescription}
                  onChange={(e) => setProjectDescription(e.target.value)}
                  className="min-h-28 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
                />

                <button
                  type="submit"
                  className="rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700"
                >
                  프로젝트 만들기
                </button>
              </form>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-xl font-semibold">내 프로젝트 목록</h3>
              <p className="mt-2 text-sm text-slate-500">
                프로젝트를 클릭하면 상세 페이지로 이동합니다.
              </p>

              <div className="mt-4 space-y-3">
                {projects.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    아직 프로젝트가 없습니다.
                  </p>
                ) : (
                  projects.map((project) => (
                    <Link
                      key={project.id}
                      href={`/projects/${project.id}`}
                      className="block rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 transition hover:bg-slate-100"
                    >
                      <p className="font-medium">{project.name}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        {project.description || '설명 없음'}
                      </p>
                      <p className="mt-2 text-xs text-slate-400">
                        생성일: {project.created_at}
                      </p>
                    </Link>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="mt-8 grid gap-6 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm text-slate-500">내 프로젝트 수</p>
              <p className="mt-3 text-3xl font-bold text-blue-600">
                {projects.length}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm text-slate-500">로그인 사용자</p>
              <p className="mt-3 text-xl font-bold text-slate-900">
                {user?.name || '-'}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm text-slate-500">이메일</p>
              <p className="mt-3 text-sm font-medium text-slate-700">
                {user?.email || '-'}
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}