'use client';

import type { UserResponse } from '../lib/adminApi';

type Props = {
  member: UserResponse;
  canEdit: boolean;
  savingId: string | null;
  onRoleChange: (idnum: string, role: string) => void;
  onRoleSave: (member: UserResponse) => void;
};

/**
 * UserTable 의 한 행 — 이름/사번/권한 셀렉트/상태/저장 버튼.
 * 행 단위로 분리해 두면 권한 편집 UX 변경이 테이블 구조와 분리된다.
 */
export default function UserRoleRow({
  member,
  canEdit,
  savingId,
  onRoleChange,
  onRoleSave,
}: Props) {
  const isSaving = savingId === member.idnum;
  const disabled = isSaving || !canEdit;

  return (
    <tr className="border-b hover:bg-slate-50">
      <td className="py-3 font-medium">{member.name}</td>
      <td className="py-3">{member.idnum}</td>
      <td className="py-3">
        <select
          value={member.role}
          onChange={(e) => onRoleChange(member.idnum, e.target.value)}
          disabled={disabled}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          <option value="user">user</option>
          <option value="admin">admin</option>
        </select>
      </td>
      <td className="py-3">
        {member.is_active ? (
          <span className="rounded-full bg-green-100 px-2 py-1 text-xs text-green-700">
            활성
          </span>
        ) : (
          <span className="rounded-full bg-slate-200 px-2 py-1 text-xs text-slate-600">
            비활성
          </span>
        )}
      </td>
      <td className="py-3">
        <button
          type="button"
          onClick={() => onRoleSave(member)}
          disabled={disabled}
          className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {isSaving ? '저장 중...' : '저장'}
        </button>
      </td>
    </tr>
  );
}
