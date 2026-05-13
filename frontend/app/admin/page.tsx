'use client';

import { useEffect, useState } from 'react';
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
type DateRange = { from: string; to: string };

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
        <div className="rounded-2xl border border-[#F4D6D6] bg-[#FFF7F7] p-6 text-sm text-[#A32D2D]">
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
        <h1 className="text-xl font-bold tracking-[-0.3px] text-[#1A1A1A]">
          관리자 설정
        </h1>
        <p className="mt-1 text-small text-[#888780]">
          사용자 권한과 프로젝트 유형별 필드 구성을 관리합니다.
        </p>
      </div>

      <div className="mb-6 flex gap-1 rounded-2xl border border-[#EAEAE4] bg-[#FAFAFA] p-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 rounded-xl px-4 py-2.5 text-body font-semibold transition ${
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
          <section className="rounded-2xl border border-[#EAEAE4] bg-white p-4">
            <div className="mb-3">
              <h3 className="text-md font-bold text-[#1A1A1A]">조회 기간</h3>
              <p className="mt-1 text-small text-[#888780]">
                선택한 담당자의 스톱워치 시간 현황과 업무 이력 현황에 함께 적용됩니다.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_auto]">
              <label className="block text-small font-semibold text-[#888780]">
                시작일
                <input
                  type="date"
                  className="mt-1 w-full rounded-lg border border-[#EAEAE4] bg-white px-3 py-2 text-body text-[#1A1A1A]"
                  value={workRange.from}
                  onChange={(event) =>
                    setWorkRange((prev) => ({ ...prev, from: event.target.value }))
                  }
                />
              </label>
              <label className="block text-small font-semibold text-[#888780]">
                종료일
                <input
                  type="date"
                  className="mt-1 w-full rounded-lg border border-[#EAEAE4] bg-white px-3 py-2 text-body text-[#1A1A1A]"
                  value={workRange.to}
                  onChange={(event) =>
                    setWorkRange((prev) => ({ ...prev, to: event.target.value }))
                  }
                />
              </label>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => setWorkRange({ from: '', to: '' })}
                  className="w-full rounded-lg border border-[#EAEAE4] px-4 py-2 text-body font-semibold text-[#534AB7] transition hover:bg-[#FAFAFA] md:w-auto"
                >
                  기간 초기화
                </button>
              </div>
            </div>
          </section>
          <StopwatchSummaryManager
            enabled={isAdmin}
            selectedUserIds={selectedOrgUserIds}
            dateRange={workRange}
          />
          <WorkHistoryManager
            enabled={isAdmin}
            users={users}
            selectedUserIds={selectedOrgUserIds}
            dateRange={workRange}
            onDateRangeChange={setWorkRange}
          />
        </div>
      )}
    </AppShell>
  );
}
