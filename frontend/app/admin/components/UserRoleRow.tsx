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
        className="cursor-pointer border-b border-surface-subtle hover:bg-surface-muted"
        onClick={() => onOpenHistory?.(member)}
      >
        <td className="py-3 pr-4 text-body font-semibold text-text">
          <span className="transition hover:text-brand">{member.name}</span>
          {member.position && (
            <span className="ml-1.5 text-micro font-medium text-text-subtle">
              {member.position}
            </span>
          )}
        </td>
        <td className="py-3 pr-4 text-small text-text-muted">{member.idnum}</td>
        <td className="py-3 pr-4 text-small text-text-muted">
          {affiliation || <span className="text-text-faint">—</span>}
        </td>
        <td className="py-3 pr-4">
          <select
            value={member.role}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => onRoleChange(member.idnum, e.target.value)}
            disabled={disabled}
            className="rounded-lg border border-border bg-white px-2.5 py-1.5 text-small text-text focus:border-brand focus:outline-none disabled:bg-surface-muted disabled:text-text-subtle"
          >
            <option value="member">일반</option>
            <option value="admin">관리자</option>
          </select>
        </td>
        <td className="py-3 pr-4">
          {member.is_active ? (
            <span className="rounded-full bg-verify-pass-bg px-2 py-1 text-tiny font-semibold text-verify-pass-fg">
              활성
            </span>
          ) : (
            <span className="rounded-full bg-surface-subtle px-2 py-1 text-tiny font-semibold text-text-subtle">
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
              className="rounded-lg bg-brand px-3 py-1.5 text-micro font-semibold text-white transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:bg-border-strong"
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
                className="rounded-lg border border-brand-soft bg-white px-3 py-1.5 text-micro font-semibold text-brand transition hover:bg-brand-soft disabled:cursor-not-allowed disabled:border-border disabled:text-text-faint"
              >
                비밀번호 초기화
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onDelete(member); }}
                disabled={disabled}
                className="rounded-lg border border-verify-fail-bg bg-white px-3 py-1.5 text-micro font-semibold text-verify-fail-fg transition hover:bg-verify-fail-bg disabled:cursor-not-allowed disabled:border-border disabled:text-text-faint"
              >
                {isDeleting ? '삭제 중...' : '삭제'}
              </button>
            )}
          </div>
        </td>
      </tr>
      {showResetPanel && (
        <tr className="border-b border-surface-subtle bg-surface-muted">
          <td colSpan={6} className="px-4 py-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-tiny font-semibold text-text-subtle">새 비밀번호</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="8자 이상"
                  className="w-[180px] rounded-lg border border-border bg-white px-3 py-1.5 text-small focus:border-brand focus:outline-none"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-tiny font-semibold text-text-subtle">비밀번호 확인</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="동일하게 입력"
                  className="w-[180px] rounded-lg border border-border bg-white px-3 py-1.5 text-small focus:border-brand focus:outline-none"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              <div className="flex items-end gap-2">
                <button
                  type="button"
                  onClick={(e) => void handleResetSubmit(e)}
                  disabled={resetting || !newPassword || !confirmPassword}
                  className="rounded-lg bg-brand px-4 py-1.5 text-micro font-semibold text-white transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:bg-border-strong"
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
                  className="rounded-lg border border-border-strong px-4 py-1.5 text-micro font-semibold text-text-muted transition hover:bg-surface-subtle"
                >
                  취소
                </button>
              </div>
              {resetError && (
                <span className="text-micro text-verify-fail-fg">{resetError}</span>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
