'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode } from 'react';
import type { Me } from '../lib/api';

type Props = {
  me: Me;
  children: ReactNode;
};

const NAV = [
  { href: '/dashboard', label: '대시보드' },
  { href: '/team-calendar', label: '팀 캘린더' },
  { href: '/personal-calendar', label: '개인 캘린더' },
  { href: '/projects', label: '프로젝트 목록' },
  { href: '/tasks', label: '할 일' },
  { href: '/team', label: '조직도' },
];

export default function AppShell({ me, children }: Props) {
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = () => {
    window.localStorage.removeItem('access_token');
    router.push('/login');
  };

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <div className="flex min-h-screen">
        <aside className="w-64 border-r border-slate-200 bg-white p-6">
          <h1 className="text-2xl font-bold text-blue-600">KPI Tool</h1>
          <p className="mt-1 text-xs text-slate-400">
            {me.role === 'admin' ? '관리자' : '일반 직원'} 화면
          </p>

          <nav className="mt-8 space-y-1">
            {NAV.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`block rounded-xl px-4 py-2.5 text-sm transition ${
                    active
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-700 hover:bg-blue-50'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        <section className="flex-1 p-8">
          <header className="flex items-center justify-between border-b border-slate-200 pb-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">
                {NAV.find((n) => n.href === pathname)?.label ?? '화면'}
              </h2>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-medium">{me.name}</p>
                <p className="text-xs text-slate-500">{me.email}</p>
              </div>
              <button
                onClick={handleLogout}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm hover:bg-slate-100"
              >
                로그아웃
              </button>
            </div>
          </header>

          <div className="mt-6">{children}</div>
        </section>
      </div>
    </main>
  );
}
