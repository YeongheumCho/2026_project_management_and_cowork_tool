'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { Me } from '../../lib/api';
import { TOP_NAV } from './nav';

type Props = {
  me: Me;
  onLogout: () => void;
  onNewProject?: () => void;
};

/**
 * 상단 바 — 로고 + 탭 네비 + "새 프로젝트" 버튼 + 로그아웃 + 사용자 아바타.
 *
 * 로그아웃은 우측 상단에 독립 버튼으로 상시 노출된다.
 * (호버 드롭다운 안에 숨기면 탭 전환 중 실수 클릭이 잦다는 피드백 반영)
 *
 * 아바타는 클릭 시 사용자 정보 + 관리자 링크를 담은 메뉴를 토글한다.
 */
export default function TopBar({ me, onLogout, onNewProject }: Props) {
  const pathname = usePathname();
  const initial = me.name?.charAt(0) ?? '?';
  const isAdmin = me.role === 'admin';

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

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

      <div className="ml-auto flex items-center gap-2">
        {isAdmin && onNewProject && (
          <button
            type="button"
            onClick={onNewProject}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            + 새 프로젝트
          </button>
        )}

        <button
          type="button"
          onClick={onLogout}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700"
        >
          로그아웃
        </button>

        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            title={`${me.name} (${me.email})`}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700 hover:bg-indigo-200"
          >
            {initial}
          </button>
          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-full z-40 mt-2 w-52 rounded-xl border border-slate-200 bg-white p-2 shadow-lg"
            >
              <div className="px-3 py-2">
                <p className="text-sm font-medium text-slate-900">{me.name}</p>
                <p className="truncate text-xs text-slate-500">{me.email}</p>
                <p className="mt-1 text-xs text-slate-400">
                  {isAdmin ? '관리자' : '일반 직원'}
                </p>
              </div>
              <div className="my-1 h-px bg-slate-100" />
              {isAdmin && (
                <Link
                  href="/admin"
                  role="menuitem"
                  onClick={() => setMenuOpen(false)}
                  className="block rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  관리자 페이지
                </Link>
              )}
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  onLogout();
                }}
                className="block w-full rounded-lg px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50"
              >
                로그아웃
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
