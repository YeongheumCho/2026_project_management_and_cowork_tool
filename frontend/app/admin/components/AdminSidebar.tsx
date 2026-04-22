'use client';

import Link from 'next/link';

/**
 * 관리자 페이지 좌측 사이드바.
 *
 * 현재는 관리자 페이지에서만 사용하지만, 네비게이션 항목이 전체 앱과
 * 겹치므로 필요해지면 상위 공용 컴포넌트로 승격 고려.
 */
export default function AdminSidebar() {
  return (
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
          프로젝트 목록
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
          조직도
        </Link>
        <Link
          href="/admin"
          className="block rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-700"
        >
          관리자
        </Link>
      </nav>
    </aside>
  );
}
