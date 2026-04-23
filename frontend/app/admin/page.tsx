'use client';

import AppShell from '../components/AppShell';
import { useMe } from '../lib/useMe';
import UserTable from './components/UserTable';
import { useAdminUsers } from './hooks/useAdminUsers';

export default function AdminPage() {
  const { me, loading: meLoading } = useMe();
  const isAdmin = me?.role === 'admin';
  const {
    users,
    loading,
    savingId,
    deletingId,
    message,
    handleRoleChange,
    handleRoleSave,
    handleUserCreate,
    handleUserDelete,
  } = useAdminUsers(isAdmin);

  if (meLoading || !me) {
    return <main className="p-8 text-slate-900">불러오는 중...</main>;
  }

  if (!isAdmin) {
    return (
      <AppShell me={me}>
        <div className="rounded-2xl border border-[#F4D6D6] bg-[#FFF7F7] p-6 text-sm text-[#A32D2D]">
          관리자만 접근할 수 있는 페이지입니다.
        </div>
      </AppShell>
    );
  }

  if (loading) {
    return <main className="p-8 text-slate-900">불러오는 중...</main>;
  }

  return (
    <AppShell me={me}>
      <div className="mb-6">
        <h1 className="text-[20px] font-bold tracking-[-0.3px] text-[#1A1A1A]">
          관리자 설정
        </h1>
        <p className="mt-1 text-[12px] text-[#888780]">
          팀원 권한과 프로젝트 템플릿만 여기에서 관리합니다. 그 외 조회는
          좌측 상단 네비게이션(개요 / 프로젝트 / 캘린더)에서 바로 확인하세요.
        </p>
      </div>

      <div className="grid gap-6">
        <UserTable
          users={users}
          canEdit
          savingId={savingId}
          deletingId={deletingId}
          message={message}
          onRoleChange={handleRoleChange}
          onRoleSave={(member) => void handleRoleSave(member)}
          onUserCreate={(payload) => handleUserCreate(payload)}
          onUserDelete={(member) => void handleUserDelete(member)}
        />
      </div>
    </AppShell>
  );
}
