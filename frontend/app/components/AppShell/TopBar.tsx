'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Me } from '../../lib/api';
import { TOP_NAV } from './nav';

type Props = {
  me: Me;
  onLogout: () => void;
  onNewProject?: () => void;
};

/**
 * 상단 바 — 로고 + 탭 네비 + "새 프로젝트" 버튼 + 사용자 아바타.
 *
 * Figma WorkFlow AI 레이아웃 기준:
 * - 좌측: 보라 "W" 로고 배지 + 브랜드 텍스트
 * - 중앙: 탭 버튼 (현재 라우트 하이라이트)
 * - 우측: + 새 프로젝트 아웃라인 버튼 + 이름 이니셜 아바타
 */
export default function TopBar({ me, onLogout, onNewProject }: Props) {
  const pathname = usePathname();
  const initial = me.name?.charAt(0) ?? '?';

  const isAdmin = me.role === 'admin';

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-6 border-b border-slate-200 bg-white px-6">
      <Link href="/dashboard" className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-sm font-bold text-white">
          W
        </span>
        <span className="text-base font-semibold text-slate-900">
          WorkFlow <span className="text-indigo-600">AI</span>
        </span>
      </Link>

      <nav className="flex items-center gap-1">
        {TOP_NAV.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-lg px-3 py-1.5 text-sm transition ${
                active
                  ? 'bg-indigo-50 font-semibold text-indigo-700'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="ml-auto flex items-center gap-3">
        {isAdmin && onNewProject && (
          <button
            type="button"
            onClick={onNewProject}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            + 새 프로젝트
          </button>
        )}

        <div className="group relative">
          <button
            type="button"
            title={`${me.name} (${me.email})`}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700"
          >
            {initial}
          </button>
          <div className="invisible absolute right-0 top-full z-40 mt-2 w-48 rounded-xl border border-slate-200 bg-white p-2 opacity-0 shadow-lg transition group-hover:visible group-hover:opacity-100">
            <div className="px-3 py-2">
              <p className="text-sm font-medium text-slate-900">{me.name}</p>
              <p className="truncate text-xs text-slate-500">{me.email}</p>
            </div>
            <div className="my-1 h-px bg-slate-100" />
            {isAdmin && (
              <Link
                href="/admin"
                className="block rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                관리자
              </Link>
            )}
            <button
              type="button"
              onClick={onLogout}
              className="block w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
            >
              로그아웃
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
