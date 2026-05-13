'use client';

import { useState } from 'react';
import AppShell from '../components/AppShell';
import { useMe } from '../lib/useMe';
import AdminOrgScopeTree from './components/AdminOrgScopeTree';
import ProjectDeletionManager from './components/ProjectDeletionManager';
import StopwatchSummaryManager from './components/StopwatchSummaryManager';
import TemplateManager from './components/TemplateManager';
import UserTable from './components/UserTable';
import WorkHistoryManager from './components/WorkHistoryManager';
import { useAdminUsers } from './hooks/useAdminUsers';

type AdminTab = 'users' | 'projects' | 'templates' | 'work-history';

const TABS: { id: AdminTab; label: string }[] = [
  { id: 'users', label: '사용자 권한 관리' },
  { id: 'projects', label: '프로젝트 삭제 관리' },
  { id: 'templates', label: '템플릿 필드 구성 관리' },
  { id: 'work-history', label: '업무 이력 관리' },
];

export default function AdminPage() {
  const { me, loading: meLoading } = useMe();
  const isAdmin = me?.role === 'admin';
  const [activeTab, setActiveTab] = useState<AdminTab>('users');
  const [selectedOrgUserIds, setSelectedOrgUserIds] = useState<Set<number> | null>(null);

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
    handlePasswordReset,
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
          사용자 권한과 프로젝트 유형별 필드 구성을 관리합니다.
        </p>
      </div>

      <div className="mb-6 flex gap-1 rounded-2xl border border-[#EAEAE4] bg-[#FAFAFA] p-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 rounded-xl px-4 py-2.5 text-[13px] font-semibold transition ${
              activeTab === tab.id
                ? 'bg-white text-[#534AB7] shadow-sm'
                : 'text-[#888780] hover:text-[#1A1A1A]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'users' && (
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
          onPasswordReset={(member, pw) => handlePasswordReset(member, pw)}
        />
      )}

      {activeTab === 'projects' && (
        <ProjectDeletionManager enabled={isAdmin} />
      )}

      {activeTab === 'templates' && (
        <TemplateManager />
      )}

      {activeTab === 'work-history' && (
        <div className="space-y-4">
          <AdminOrgScopeTree
            users={users}
            selectedIds={selectedOrgUserIds}
            onSelect={setSelectedOrgUserIds}
          />
          <StopwatchSummaryManager
            enabled={isAdmin}
            selectedUserIds={selectedOrgUserIds}
          />
          <WorkHistoryManager
            enabled={isAdmin}
            users={users}
            selectedUserIds={selectedOrgUserIds}
          />
        </div>
      )}
    </AppShell>
  );
}
