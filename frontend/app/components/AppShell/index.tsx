'use client';

import { useRouter } from 'next/navigation';
import { ReactNode } from 'react';
import type { Me, Project, UserBrief } from '../../lib/api';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import { useSidebarData } from './useSidebarData';

type Props = {
  me: Me;
  children: ReactNode;
  /** "+ 새 프로젝트" 버튼 핸들러 — 미지정 시 버튼이 렌더되지 않음 */
  onNewProject?: () => void;
  selectedProjectId?: number | null;
  selectedMemberId?: number | null;
  onProjectSelect?: (projectId: number) => void;
  onMemberSelect?: (memberId: number) => void;
  sidebarProjects?: Project[];
  sidebarUsers?: UserBrief[];
};

/**
 * 앱 전체 공통 쉘.
 *
 * 구조 (Figma "WorkFlow AI" 레이아웃):
 *   ┌──────────────────── TopBar ────────────────────┐
 *   │ [W] WorkFlow AI  개요 캘린더...  + 새 프로젝트 👤 │
 *   ├───────────────┬────────────────────────────────┤
 *   │               │                                │
 *   │   Sidebar     │           children             │
 *   │  (프로젝트·팀) │                                │
 *   │               │                                │
 *   └───────────────┴────────────────────────────────┘
 *
 * 페이지별 헤더/제목은 각 라우트가 children 내에서 직접 그린다 —
 * shell 은 전역 네비와 사이드바만 책임지며, 페이지별 상단 서브헤더는
 * Figma 각 탭에서 본 것처럼 페이지 안에 둔다.
 */
export default function AppShell({
  me,
  children,
  onNewProject,
  selectedProjectId,
  selectedMemberId,
  onProjectSelect,
  onMemberSelect,
  sidebarProjects,
  sidebarUsers,
}: Props) {
  const router = useRouter();
  const { projects, users } = useSidebarData();

  const handleLogout = () => {
    window.localStorage.removeItem('access_token');
    router.push('/login');
  };

  return (
    <main className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <TopBar me={me} onLogout={handleLogout} onNewProject={onNewProject} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          projects={sidebarProjects ?? projects}
          users={sidebarUsers ?? users}
          myTeam={me.team}
          selectedProjectId={selectedProjectId}
          selectedMemberId={selectedMemberId}
          onProjectSelect={onProjectSelect}
          onMemberSelect={onMemberSelect}
        />
        <section className="flex-1 overflow-y-auto px-8 py-6">
          {children}
        </section>
      </div>
    </main>
  );
}
