'use client';

import { useState } from 'react';
import type { UserResponse } from '../lib/adminApi';

type Props = {
  member: UserResponse;
  canEdit: boolean;
  savingId: string | null;
  deletingId: string | null;
  onRoleChange: (idnum: string, role: string) => void;
  onRoleSave: (member: UserResponse) => void;
  onDelete?: (member: UserResponse) => void;
  onOpenHistory?: (member: UserResponse) => void;
  onPasswordReset?: (member: UserResponse, newPassword: string) => Promise<boolean>;
};

export default function UserRoleRow({
  member,
  canEdit,
  savingId,
  deletingId,
  onRoleChange,
  onRoleSave,
  onDelete,
  onOpenHistory,
  onPasswordReset,
}: Props) {
  const isSaving = savingId === member.idnum;
  const isDeleting = deletingId === member.idnum;
  const disabled = isSaving || isDeleting || !canEdit;

  const [showResetPanel, setShowResetPanel] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState('');

  const affiliation = [member.center, member.office, member.team]
    .map((value) => (value ?? '').trim())
    .filter(Boolean)
    .join(' · ');

  const handleResetSubmit = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setResetError('');
    if (newPassword.length < 8) {
      setResetError('비밀번호는 8자 이상이어야 합니다.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setResetError('비밀번호가 일치하지 않습니다.');
      return;
    }
    setResetting(true);
    const ok = await onPasswordReset?.(member, newPassword);
    setResetting(false);
    if (ok) {
      setShowResetPanel(false);
      setNewPassword('');
      setConfirmPassword('');
    } else {
      setResetError('비밀번호 초기화에 실패했습니다.');
    }
  };

  return (
    <>
      <tr
        className="cursor-pointer border-b border-[#F1EFE8] hover:bg-[#FAFAFA]"
        onClick={() => onOpenHistory?.(member)}
      >
        <td className="py-3 pr-4 text-body font-semibold text-[#1A1A1A]">
          <span className="transition hover:text-[#534AB7]">{member.name}</span>
          {member.position && (
            <span className="ml-1.5 text-micro font-medium text-[#888780]">
              {member.position}
            </span>
          )}
        </td>
        <td className="py-3 pr-4 text-small text-[#5F5E5A]">{member.idnum}</td>
        <td className="py-3 pr-4 text-small text-[#5F5E5A]">
          {affiliation || <span className="text-[#B4B2A9]">—</span>}
        </td>
        <td className="py-3 pr-4">
          <select
            value={member.role}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => onRoleChange(member.idnum, e.target.value)}
            disabled={disabled}
            className="rounded-lg border border-[#EAEAE4] bg-white px-2.5 py-1.5 text-small text-[#1A1A1A] focus:border-[#534AB7] focus:outline-none disabled:bg-[#FAFAFA] disabled:text-[#888780]"
          >
            <option value="member">일반</option>
            <option value="admin">관리자</option>
          </select>
        </td>
        <td className="py-3 pr-4">
          {member.is_active ? (
            <span className="rounded-full bg-[#E8F5ED] px-2 py-1 text-tiny font-semibold text-[#1F7A3A]">
              활성
            </span>
          ) : (
            <span className="rounded-full bg-[#F1EFE8] px-2 py-1 text-tiny font-semibold text-[#888780]">
              비활성
            </span>
          )}
        </td>
        <td className="py-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onRoleSave(member); }}
              disabled={disabled}
              className="rounded-lg bg-[#534AB7] px-3 py-1.5 text-micro font-semibold text-white transition hover:bg-[#43399C] disabled:cursor-not-allowed disabled:bg-[#D3D1C7]"
            >
              {isSaving ? '저장 중...' : '저장'}
            </button>
            {onPasswordReset && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowResetPanel((prev) => !prev);
                  setNewPassword('');
                  setConfirmPassword('');
                  setResetError('');
                }}
                disabled={disabled}
                className="rounded-lg border border-[#D0C9F5] bg-white px-3 py-1.5 text-micro font-semibold text-[#534AB7] transition hover:bg-[#EEEDFE] disabled:cursor-not-allowed disabled:border-[#E9E5E5] disabled:text-[#B4B2A9]"
              >
                비밀번호 초기화
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onDelete(member); }}
                disabled={disabled}
                className="rounded-lg border border-[#F4C9C9] bg-white px-3 py-1.5 text-micro font-semibold text-[#A32D2D] transition hover:bg-[#FFF4F4] disabled:cursor-not-allowed disabled:border-[#E9E5E5] disabled:text-[#B4B2A9]"
              >
                {isDeleting ? '삭제 중...' : '삭제'}
              </button>
            )}
          </div>
        </td>
      </tr>
      {showResetPanel && (
        <tr className="border-b border-[#F1EFE8] bg-[#FAFAFA]">
          <td colSpan={6} className="px-4 py-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-tiny font-semibold text-[#888780]">새 비밀번호</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="8자 이상"
                  className="w-[180px] rounded-lg border border-[#EAEAE4] bg-white px-3 py-1.5 text-small focus:border-[#534AB7] focus:outline-none"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-tiny font-semibold text-[#888780]">비밀번호 확인</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="동일하게 입력"
                  className="w-[180px] rounded-lg border border-[#EAEAE4] bg-white px-3 py-1.5 text-small focus:border-[#534AB7] focus:outline-none"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              <div className="flex items-end gap-2">
                <button
                  type="button"
                  onClick={(e) => void handleResetSubmit(e)}
                  disabled={resetting || !newPassword || !confirmPassword}
                  className="rounded-lg bg-[#534AB7] px-4 py-1.5 text-micro font-semibold text-white transition hover:bg-[#43399C] disabled:cursor-not-allowed disabled:bg-[#D3D1C7]"
                >
                  {resetting ? '처리 중...' : '확인'}
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowResetPanel(false);
                    setNewPassword('');
                    setConfirmPassword('');
                    setResetError('');
                  }}
                  className="rounded-lg border border-[#D3D1C7] px-4 py-1.5 text-micro font-semibold text-[#5F5E5A] transition hover:bg-[#F1EFE8]"
                >
                  취소
                </button>
              </div>
              {resetError && (
                <span className="text-micro text-[#E05C5C]">{resetError}</span>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
