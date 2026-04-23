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
 * UserTable 의 한 행 — 이름/사번/소속/권한/상태/저장.
 * role 값은 백엔드 스키마 기준으로 "admin" / "member" 만 허용한다.
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

  // 센터/실/팀 중 비어있지 않은 것만 ' · ' 로 연결
  const affiliation = [member.center, member.office, member.team]
    .map((value) => (value ?? '').trim())
    .filter(Boolean)
    .join(' · ');

  return (
    <tr className="border-b border-[#F1EFE8] hover:bg-[#FAFAFA]">
      <td className="py-3 pr-4 text-[13px] font-semibold text-[#1A1A1A]">
        {member.name}
        {member.position && (
          <span className="ml-1.5 text-[11px] font-medium text-[#888780]">
            {member.position}
          </span>
        )}
      </td>
      <td className="py-3 pr-4 text-[12px] text-[#5F5E5A]">{member.idnum}</td>
      <td className="py-3 pr-4 text-[12px] text-[#5F5E5A]">
        {affiliation || <span className="text-[#B4B2A9]">—</span>}
      </td>
      <td className="py-3 pr-4">
        <select
          value={member.role}
          onChange={(e) => onRoleChange(member.idnum, e.target.value)}
          disabled={disabled}
          className="rounded-lg border border-[#EAEAE4] bg-white px-2.5 py-1.5 text-[12px] text-[#1A1A1A] focus:border-[#534AB7] focus:outline-none disabled:bg-[#FAFAFA] disabled:text-[#888780]"
        >
          <option value="member">일반</option>
          <option value="admin">관리자</option>
        </select>
      </td>
      <td className="py-3 pr-4">
        {member.is_active ? (
          <span className="rounded-full bg-[#E8F5ED] px-2 py-1 text-[10px] font-semibold text-[#1F7A3A]">
            활성
          </span>
        ) : (
          <span className="rounded-full bg-[#F1EFE8] px-2 py-1 text-[10px] font-semibold text-[#888780]">
            비활성
          </span>
        )}
      </td>
      <td className="py-3">
        <button
          type="button"
          onClick={() => onRoleSave(member)}
          disabled={disabled}
          className="rounded-lg bg-[#534AB7] px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-[#43399C] disabled:cursor-not-allowed disabled:bg-[#D3D1C7]"
        >
          {isSaving ? '저장 중...' : '저장'}
        </button>
      </td>
    </tr>
  );
}
