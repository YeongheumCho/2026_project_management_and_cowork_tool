'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Me } from '../../lib/api';
import { TOP_NAV, type NavItem } from './nav';
import Button from '../Button';

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
    <header className="sticky top-0 z-30 flex h-14 items-center gap-6 border-b-[1.5px] border-brand bg-surface px-5">
      <Link href="/dashboard" className="flex items-center">
        <Image
          src="/logo.png"
          alt="SureLog AI"
          width={160}
          height={50}
          priority
          className="h-10 w-auto"
        />
      </Link>

      <nav className="flex items-center gap-0.5">
        {navItems.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-lg px-3.5 py-1 text-xs transition ${
                active
                  ? 'bg-brand font-bold text-white'
                  : 'font-medium text-text-muted hover:bg-surface-subtle'
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="ml-auto flex items-center gap-2">
        {isAdmin && onNewProject && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onNewProject}
            aria-label="새 프로젝트 만들기"
          >
            + 프로젝트
          </Button>
        )}

        <Button
          variant="secondary"
          size="sm"
          onClick={onLogout}
        >
          로그아웃
        </Button>

        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((value) => !value)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label={`${me.name} 계정 메뉴`}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-micro font-bold text-white hover:bg-brand-hover"
          >
            {initial}
          </button>

          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-full z-40 mt-2 w-56 rounded-2xl border border-border-strong bg-surface p-2 shadow-lg"
            >
              <div className="px-3 py-2">
                <p className="text-sm font-medium text-text">{me.name}</p>
                <p className="truncate text-xs text-text-subtle">{me.idnum}</p>
                <p className="mt-1 text-xs text-text-faint">
                  {isAdmin ? '관리자' : '구성원'}
                </p>
              </div>
              <div className="my-1 h-px bg-surface-subtle" />

              <Link
                href="/settings"
                role="menuitem"
                onClick={() => setMenuOpen(false)}
                className="block rounded-lg px-3 py-2 text-sm text-text-muted hover:bg-background"
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
                className="block w-full rounded-lg px-3 py-2 text-left text-sm text-verify-fail-fg hover:bg-verify-fail-bg"
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
