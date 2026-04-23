'use client';

import { useMemo, useState } from 'react';
import type { UserResponse } from '../lib/adminApi';
import UserRoleRow from './UserRoleRow';

type Props = {
  users: UserResponse[];
  canEdit: boolean;
  savingId: string | null;
  message: string | null;
  onRoleChange: (idnum: string, role: string) => void;
  onRoleSave: (member: UserResponse) => void;
};

type RoleFilter = 'all' | 'admin' | 'member';

/**
 * 팀원 관리 테이블 — 관리자 전용.
 *
 * 대시보드 카드 스타일(#EAEAE4 / 534AB7 톤) 과 일관된 외형으로,
 * 검색(이름/사번/팀) 과 권한 필터를 상단에서 바로 지원한다.
 */
export default function UserTable({
  users,
  canEdit,
  savingId,
  message,
  onRoleChange,
  onRoleSave,
}: Props) {
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return users.filter((user) => {
      if (roleFilter !== 'all' && user.role !== roleFilter) return false;
      if (!needle) return true;
      const haystack = [
        user.name,
        user.idnum,
        user.center,
        user.office,
        user.team,
        user.position,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [users, query, roleFilter]);

  const adminCount = useMemo(
    () => users.filter((user) => user.role === 'admin').length,
    [users],
  );

  return (
    <div className="rounded-2xl border border-[#EAEAE4] bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-[15px] font-bold text-[#1A1A1A]">팀원 권한 관리</h3>
          <p className="mt-0.5 text-[11px] text-[#888780]">
            전체 {users.length}명 · 관리자 {adminCount}명
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-full border border-[#EAEAE4] bg-[#FAFAFA] p-0.5">
            {(['all', 'admin', 'member'] as RoleFilter[]).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setRoleFilter(value)}
                className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${
                  roleFilter === value
                    ? 'bg-white text-[#534AB7] shadow-sm'
                    : 'text-[#888780] hover:text-[#1A1A1A]'
                }`}
              >
                {value === 'all' ? '전체' : value === 'admin' ? '관리자' : '일반'}
              </button>
            ))}
          </div>

          <input
            type="search"
            placeholder="이름 · 사번 · 팀 검색"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-[220px] rounded-lg border border-[#EAEAE4] px-3 py-1.5 text-[12px] text-[#1A1A1A] placeholder:text-[#B4B2A9] focus:border-[#534AB7] focus:outline-none"
          />
        </div>
      </div>

      {message && (
        <p className="mt-3 rounded-lg bg-[#EEEDFE] px-3 py-2 text-[12px] text-[#534AB7]">
          {message}
        </p>
      )}

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-[12px]">
          <thead className="border-b border-[#EAEAE4] text-[10px] font-bold uppercase tracking-[1px] text-[#888780]">
            <tr>
              <th className="py-2 pr-4">이름</th>
              <th className="py-2 pr-4">사번</th>
              <th className="py-2 pr-4">소속</th>
              <th className="py-2 pr-4">권한</th>
              <th className="py-2 pr-4">상태</th>
              <th className="py-2">저장</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((member) => (
              <UserRoleRow
                key={member.idnum}
                member={member}
                canEdit={canEdit}
                savingId={savingId}
                onRoleChange={onRoleChange}
                onRoleSave={onRoleSave}
              />
            ))}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <p className="py-8 text-center text-[12px] text-[#888780]">
            {users.length === 0
              ? '등록된 사용자가 없습니다.'
              : '검색 조건에 맞는 사용자가 없습니다.'}
          </p>
        )}
      </div>
    </div>
  );
}
