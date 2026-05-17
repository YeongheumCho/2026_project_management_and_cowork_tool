'use client';

import { useEffect, useState } from 'react';
import AppShell from '../components/AppShell';
import type { UserBrief } from '../lib/api';
import { useMe } from '../lib/useMe';
import MajorProjectManager from './components/MajorProjectManager';
import ProjectDeletionManager from './components/ProjectDeletionManager';
import TemplateManager from './components/TemplateManager';
import UserTable from './components/UserTable';
import WorkStatusManager from './components/WorkStatusManager';
import { useAdminUsers } from './hooks/useAdminUsers';

type AdminTab = 'users' | 'major-projects' | 'templates' | 'work-history';
type DateRange = { from: string; to: string };

const TABS: { id: AdminTab; label: string }[] = [
  { id: 'users', label: '사용자 권한 관리' },
  { id: 'major-projects', label: '프로젝트 관리' },
  { id: 'templates', label: '템플릿 관리' },
  { id: 'work-history', label: '업무 이력 관리' },
];

export default function AdminPage() {
  const { me, loading: meLoading } = useMe();
  const isAdmin = me?.role === 'admin';
  const [activeTab, setActiveTab] = useState<AdminTab>('users');
  const [selectedOrgUserIds, setSelectedOrgUserIds] = useState<Set<number> | null>(null);
  const [workRange, setWorkRange] = useState<DateRange>({ from: '', to: '' });
  const [workScopeInitialized, setWorkScopeInitialized] = useState(false);

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

  useEffect(() => {
    if (!isAdmin || workScopeInitialized || users.length === 0) return;
    const adminTeam = me?.team?.trim();
    if (adminTeam) {
      const teamIds = users
        .filter((user) => user.team?.trim() === adminTeam)
        .map((user) => user.id);
      setSelectedOrgUserIds(teamIds.length > 0 ? new Set(teamIds) : null);
    }
    setWorkScopeInitialized(true);
  }, [isAdmin, me?.team, users, workScopeInitialized]);

  if (meLoading || !me) {
    return <main className="p-8 text-text">불러오는 중...</main>;
  }

  if (!isAdmin) {
    return (
      <AppShell me={me}>
        <div className="rounded-2xl border border-verify-fail-bg bg-verify-fail-bg p-6 text-sm text-verify-fail-fg">
          관리자만 접근할 수 있는 페이지입니다.
        </div>
      </AppShell>
    );
  }

  if (loading) {
    return <main className="p-8 text-text">불러오는 중...</main>;
  }

  return (
    <AppShell me={me}>
      <div className="mb-6">
        <h1 className="text-xl font-bold tracking-[-0.3px] text-text">
          관리자 설정
        </h1>
        <p className="mt-1 text-small text-text-subtle">
          사용자 권한과 프로젝트, 템플릿, 업무 이력을 관리합니다.
        </p>
      </div>

      <div className="mb-6 flex gap-1 rounded-2xl border border-border bg-surface-muted p-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 rounded-xl px-4 py-2.5 text-body font-semibold transition ${
              activeTab === tab.id
                ? 'bg-white text-brand shadow-sm'
                : 'text-text-subtle hover:text-text'
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


      {activeTab === 'major-projects' && (
        <div className="space-y-4">
          <MajorProjectManager users={users as UserBrief[]} />
          <ProjectDeletionManager enabled={isAdmin} />
        </div>
      )}

      {activeTab === 'templates' && (
        <TemplateManager />
      )}

      {activeTab === 'work-history' && (
        <WorkStatusManager
          enabled={isAdmin}
          users={users}
          selectedUserIds={selectedOrgUserIds}
          onSelectedUserIdsChange={setSelectedOrgUserIds}
          dateRange={workRange}
          onDateRangeChange={setWorkRange}
        />
      )}
    </AppShell>
  );
}
