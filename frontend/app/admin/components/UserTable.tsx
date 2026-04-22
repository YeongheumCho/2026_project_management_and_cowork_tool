'use client';

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

/**
 * 팀원 목록 테이블 — 헤더/메시지/행 렌더.
 * 행 자체는 UserRoleRow 로 분리되어 있어 셀 단위 변경과
 * 테이블 래퍼 변경이 서로 간섭하지 않는다.
 */
export default function UserTable({
  users,
  canEdit,
  savingId,
  message,
  onRoleChange,
  onRoleSave,
}: Props) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold">팀원 목록</h3>
        <span className="text-sm text-slate-500">총 {users.length}명</span>
      </div>

      {message && (
        <p className="mt-4 rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-700">
          {message}
        </p>
      )}

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b text-slate-500">
            <tr>
              <th className="py-2">이름</th>
              <th className="py-2">사번</th>
              <th className="py-2">권한</th>
              <th className="py-2">상태</th>
              <th className="py-2">저장</th>
            </tr>
          </thead>
          <tbody>
            {users.map((member) => (
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

        {users.length === 0 && (
          <p className="py-6 text-center text-sm text-slate-500">
            등록된 사용자가 없습니다.
          </p>
        )}
      </div>
    </div>
  );
}
