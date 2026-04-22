'use client';

import type { UserResponse } from '../lib/adminApi';

type Props = {
  user: UserResponse | null;
  onLogout: () => void;
};

/**
 * 관리자 페이지 상단 헤더 — 타이틀 + 현재 로그인 사용자 + 로그아웃.
 */
export default function AdminHeader({ user, onLogout }: Props) {
  return (
    <header className="flex items-center justify-between border-b border-slate-200 pb-6">
      <div>
        <h2 className="text-3xl font-bold text-green-600">
          EM_Center 업무 추천 시스템
        </h2>
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
          onClick={onLogout}
          className="rounded-xl border border-slate-200 px-4 py-2 text-sm hover:bg-slate-100"
        >
          로그아웃
        </button>
      </div>
    </header>
  );
}
