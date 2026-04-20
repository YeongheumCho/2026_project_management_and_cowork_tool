'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const API_BASE_URL = 'http://127.0.0.1:8000';

type MeResponse = {
  idnum: string;
  name: string;
  is_active: boolean;
  created_at: string;
  role: string;

};

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMe = async () => {
      const token = localStorage.getItem('access_token');

      if (!token) {
        router.replace('/login');
        return;
      }

      try {
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
      } catch {
        localStorage.removeItem('access_token');
        router.replace('/login');
      } finally {
        setLoading(false);
      }
    };

    void fetchMe();
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    router.push('/login');
  };

  if (loading) {
    return <main className="p-8 text-white">불러오는 중...</main>;
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
  <div className="flex min-h-screen">

    {/* 사이드바 */}
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
        <Link href="/admin" className="block rounded-xl px-4 py-3 text-sm hover:bg-blue-50">
          관리자
        </Link>
        {/* 관리자 권한이 있는 사용자에게만 관리자 페이지 링크 표시 

        {user?.role === 'admin' && (
        <Link href="/admin" className="block rounded-xl px-4 py-3 text-sm hover:bg-blue-50">
          관리자
        </Link>
      )} 
          */}
      </nav>
    </aside>

    {/* 메인 */}
    <section className="flex-1 p-8">

      {/* 헤더 */}
      <header className="flex items-center justify-between border-b border-slate-200 pb-6">
        <div>
          <h2 className="text-3xl font-bold text-green-600">EM_Center 업무 추천 시스템</h2>
          <p className="mt-2 text-sm text-slate-500">
            프로젝트와 업무 현황을 한눈에 확인하는 공간
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

      {/* 카드 영역 */}
      <div className="mt-8 grid gap-6 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">현재 진행 중 프로젝트</p>
          <p className="mt-3 text-3xl font-bold text-blue-600">3</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">오늘 마감 업무</p>
          <p className="mt-3 text-3xl font-bold text-blue-600">7</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">현재 근무 인원 수</p>
          <p className="mt-3 text-3xl font-bold text-blue-600">25</p>
        </div>
      </div>

      {/* 하단 */}
      <div className="mt-8 grid gap-6 lg:grid-cols-2">

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-xl font-semibold">신규 프로젝트</h3>
          <div className="mt-4 space-y-3">
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="font-medium">협업툴 제작 KPI 개발</p>
              <p className="mt-1 text-sm text-slate-500">
                현재 9명의 근무 인원 투입 및 신규 1인 필요
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-xl font-semibold">오늘의 할 일</h3>
          <div className="mt-4 space-y-3">
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="font-medium">로그인이후 Realtime 개발</p>
              <p className="mt-1 text-sm text-slate-500">우선순위: 높음</p>
            </div>
          </div>
        </div>

      </div>
    </section>
  </div>
</main>
  );
}
