'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Me } from '../../lib/api';
import { TOP_NAV, type NavItem } from './nav';

type Props = {
  me: Me;
  onLogout: () => void;
  onNewProject?: () => void;
};

export default function TopBar({ me, onLogout, onNewProject }: Props) {
  const pathname = usePathname();
  const initial = me.name?.charAt(0) ?? '?';
  const isAdmin = me.role === 'admin';
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const navItems = useMemo<NavItem[]>(() => {
    const visibleNav = isAdmin
      ? TOP_NAV
      : TOP_NAV.filter((item) => item.href !== '/tasks');
    return isAdmin ? [...visibleNav, { href: '/admin', label: '관리' }] : visibleNav;
  }, [isAdmin]);

  useEffect(() => {
    if (!menuOpen) return;

    const handleDocumentClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };

    document.addEventListener('mousedown', handleDocumentClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleDocumentClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [menuOpen]);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-6 border-b-[1.5px] border-[#534AB7] bg-white px-5">
      <Link href="/dashboard" className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-[7px] bg-[#534AB7] text-body font-bold text-white">
          W
        </span>
        <span className="text-base font-bold tracking-[-0.3px] text-[#1A1A1A]">
          WorkFlow <span className="text-[#534AB7]">AI</span>
        </span>
      </Link>

      <nav className="flex items-center gap-0.5">
        {navItems.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-lg px-[14px] py-[5px] text-xs transition ${
                active
                  ? 'bg-[#534AB7] font-bold text-white'
                  : 'font-medium text-[#5F5E5A] hover:bg-[#F1EFE8]'
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
            className="rounded-lg border border-[#AFA9EC] bg-[#EEEDFE] px-[14px] py-[6px] text-xs font-bold text-[#534AB7] hover:bg-[#E5E3FD]"
          >
            + 프로젝트
          </button>
        )}

        <button
          type="button"
          onClick={onLogout}
          className="rounded-lg border border-[#EAEAE4] px-[14px] py-[6px] text-xs font-semibold text-[#5F5E5A] hover:bg-[#F1EFE8]"
        >
          로그아웃
        </button>

        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((value) => !value)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            title={`${me.name} (${me.idnum})`}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[#534AB7] text-micro font-bold text-white hover:bg-[#433A9A]"
          >
            {initial}
          </button>

          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-full z-40 mt-2 w-56 rounded-2xl border border-[#D3D1C7] bg-white p-2 shadow-lg"
            >
              <div className="px-3 py-2">
                <p className="text-sm font-medium text-[#1A1A1A]">{me.name}</p>
                <p className="truncate text-xs text-[#888780]">{me.idnum}</p>
                <p className="mt-1 text-xs text-[#B4B2A9]">
                  {isAdmin ? '관리자' : '구성원'}
                </p>
              </div>
              <div className="my-1 h-px bg-[#F1EFE8]" />

              <Link
                href="/settings"
                role="menuitem"
                onClick={() => setMenuOpen(false)}
                className="block rounded-lg px-3 py-2 text-sm text-[#5F5E5A] hover:bg-[#F8F8F5]"
              >
                설정
              </Link>

              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  onLogout();
                }}
                className="block w-full rounded-lg px-3 py-2 text-left text-sm text-[#A32D2D] hover:bg-[#FCEBEB]"
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
