'use client';

import { useRouter } from 'next/navigation';
import { ReactNode, useLayoutEffect, useRef, useState } from 'react';
import type { MajorProject, Me, Project, SubProject, UserBrief } from '../../lib/api';
import ProgressLogModal from '../../projects/components/ProgressLogModal';
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
  onSubprojectSelect?: (subproject: SubProject) => void;
  /** shell 내장 진행률 기록 모달 저장 후 호출 — onSubprojectSelect 미지정 시에만 사용 */
  onProgressLogSaved?: () => Promise<void> | void;
  sidebarProjects?: Project[];
  sidebarMajorProjects?: MajorProject[];
  sidebarSubprojects?: SubProject[];
  sidebarUsers?: UserBrief[];
};

const SIDEBAR_WIDTH_KEY = 'sidebar_width';
const SIDEBAR_DEFAULT_WIDTH = 240;
const SIDEBAR_MIN_WIDTH = 200;
const SIDEBAR_MAX_WIDTH = 480;

function clampSidebarWidth(width: number) {
  return Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, Math.round(width)));
}

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
  onSubprojectSelect,
  onProgressLogSaved,
  sidebarProjects,
  sidebarMajorProjects,
  sidebarSubprojects,
  sidebarUsers,
}: Props) {
  const router = useRouter();
  const { majorProjects, projects, subprojects, users, reload } = useSidebarData();
  const [shellProgressTarget, setShellProgressTarget] = useState<SubProject | null>(null);
  const handleSubprojectSelect = onSubprojectSelect ?? setShellProgressTarget;

  // 서버 렌더와 첫 클라이언트 렌더는 기본 폭으로 맞추고, 저장된 폭은 페이지마다 AppShell이
  // 다시 마운트될 때 첫 페인트 전에 적용해 폭이 튀지 않게 한다.
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT_WIDTH);
  const resizeRef = useRef<{ startX: number; startWidth: number; latest: number } | null>(null);

  useLayoutEffect(() => {
    try {
      const stored = Number(window.localStorage.getItem(SIDEBAR_WIDTH_KEY));
      if (Number.isFinite(stored) && stored > 0) setSidebarWidth(clampSidebarWidth(stored));
    } catch {
      // 저장소 접근 불가 시 기본 폭 유지
    }
  }, []);

  const startSidebarResize = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    resizeRef.current = { startX: event.clientX, startWidth: sidebarWidth, latest: sidebarWidth };

    const handleMove = (moveEvent: MouseEvent) => {
      const state = resizeRef.current;
      if (!state) return;
      // 컨텍스트 메뉴 등으로 mouseup 을 놓친 경우 버튼이 떼어진 상태를 감지해 드래그를 끝낸다.
      if (moveEvent.buttons === 0) {
        handleUp();
        return;
      }
      const next = clampSidebarWidth(state.startWidth + moveEvent.clientX - state.startX);
      state.latest = next;
      setSidebarWidth(next);
    };
    function handleUp() {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      const latest = resizeRef.current?.latest;
      resizeRef.current = null;
      if (latest == null) return;
      try {
        window.localStorage.setItem(SIDEBAR_WIDTH_KEY, String(latest));
      } catch {
        // 저장 실패는 무시
      }
    }

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  };

  const resetSidebarWidth = () => {
    setSidebarWidth(SIDEBAR_DEFAULT_WIDTH);
    try {
      window.localStorage.removeItem(SIDEBAR_WIDTH_KEY);
    } catch {
      // 저장 실패는 무시
    }
  };

  const handleLogout = () => {
    window.localStorage.removeItem('access_token');
    router.push('/login');
  };

  return (
    <main className="flex min-h-screen flex-col bg-surface-muted text-text">
      <TopBar me={me} onLogout={handleLogout} onNewProject={onNewProject} />
      <div className="flex flex-1 overflow-hidden">
        <div className="relative hidden shrink-0 lg:flex" style={{ width: sidebarWidth }}>
          <Sidebar
            majorProjects={sidebarMajorProjects ?? majorProjects}
            projects={sidebarProjects ?? projects}
            subprojects={sidebarSubprojects ?? subprojects}
            users={sidebarUsers ?? users}
            myTeam={me.team}
            selectedProjectId={selectedProjectId}
            selectedMemberId={selectedMemberId}
            onProjectSelect={onProjectSelect}
            onMemberSelect={onMemberSelect}
            onSubprojectSelect={handleSubprojectSelect}
          />
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="사이드바 폭 조절"
            title="드래그해서 폭 조절 · 더블클릭하면 기본 폭으로"
            onMouseDown={startSidebarResize}
            onDoubleClick={resetSidebarWidth}
            className="absolute inset-y-0 -right-2 z-10 w-2 cursor-col-resize transition hover:bg-brand-soft"
          />
        </div>
        <section className="flex-1 overflow-y-auto px-8 py-6">
          {children}
        </section>
      </div>
      {!onSubprojectSelect && (
        <ProgressLogModal
          open={shellProgressTarget !== null}
          subproject={shellProgressTarget}
          onClose={() => setShellProgressTarget(null)}
          onSaved={async () => {
            await Promise.all([reload(), onProgressLogSaved?.()]);
          }}
        />
      )}
    </main>
  );
}
