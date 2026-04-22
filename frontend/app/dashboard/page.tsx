'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '../components/AppShell';
import { useMe } from '../lib/useMe';
import CreateProjectModal from '../projects/components/CreateProjectModal';
import DashboardHeader from './components/DashboardHeader';
import KpiGrid from './components/KpiGrid';
import ProjectList from './components/ProjectList';
import TimerWidget from './components/TimerWidget';
import { useDashboardData } from './hooks/useDashboardData';

/**
 * 개요(대시보드) 페이지.
 *
 * Figma 개요 탭처럼 사이드바 선택과 메인 패널이 함께 반응하도록
 * 프로젝트/팀원 선택 상태를 이 레벨에서 조율한다.
 */
export default function DashboardPage() {
  const router = useRouter();
  const { me, loading: meLoading } = useMe();
  const enabled = !!me;
  const {
    projects,
    subprojects,
    users,
    summary,
    loading,
    error,
    todayIso,
    reload,
  } = useDashboardData(enabled);

  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [modalError, setModalError] = useState('');

  const filteredSubprojects = useMemo(() => {
    if (!selectedMemberId) return subprojects;
    return subprojects.filter(
      (subproject) => subproject.assignee_id === selectedMemberId,
    );
  }, [selectedMemberId, subprojects]);

  const visibleProjects = useMemo(() => {
    if (!selectedMemberId) return projects;
    const visibleIds = new Set(
      filteredSubprojects.map((subproject) => subproject.project_id),
    );
    return projects.filter((project) => visibleIds.has(project.id));
  }, [filteredSubprojects, projects, selectedMemberId]);

  useEffect(() => {
    if (visibleProjects.length === 0) {
      setSelectedProjectId(null);
      return;
    }

    if (
      selectedProjectId === null ||
      !visibleProjects.some((project) => project.id === selectedProjectId)
    ) {
      setSelectedProjectId(visibleProjects[0].id);
    }
  }, [selectedProjectId, visibleProjects]);

  const selectedProject = useMemo(
    () => visibleProjects.find((project) => project.id === selectedProjectId) ?? null,
    [selectedProjectId, visibleProjects],
  );

  const timerCandidates = useMemo(() => {
    if (!selectedProject) return [];
    return filteredSubprojects.filter(
      (subproject) =>
        subproject.project_id === selectedProject.id &&
        subproject.start_date <= todayIso &&
        subproject.end_date >= todayIso &&
        subproject.status !== 'completed',
    );
  }, [filteredSubprojects, selectedProject, todayIso]);

  const timerHelperText = useMemo(() => {
    if (!selectedProject && selectedMemberId) {
      return '선택한 팀원이 담당한 프로젝트가 없습니다.';
    }
    if (!selectedProject) {
      return '왼쪽에서 프로젝트를 선택해 주세요';
    }
    if (selectedMemberId) {
      return '선택한 팀원 기준으로 이 프로젝트의 진행 중 업무만 보여줍니다.';
    }
    return '프로젝트를 선택하고 시작하세요';
  }, [selectedMemberId, selectedProject]);

  const handleProjectSelect = (projectId: number) => {
    const hasVisibleTask = filteredSubprojects.some(
      (subproject) => subproject.project_id === projectId,
    );
    if (selectedMemberId && !hasVisibleTask) {
      setSelectedMemberId(null);
    }
    setSelectedProjectId(projectId);
  };

  if (meLoading || !me) {
    return <main className="p-8 text-slate-900">불러오는 중...</main>;
  }

  return (
    <AppShell
      me={me}
      onNewProject={
        me.role === 'admin'
          ? () => {
              setModalError('');
              setCreateOpen(true);
            }
          : undefined
      }
      selectedProjectId={selectedProjectId}
      selectedMemberId={selectedMemberId}
      onProjectSelect={handleProjectSelect}
      onMemberSelect={(memberId) =>
        setSelectedMemberId((current) => (current === memberId ? null : memberId))
      }
      sidebarProjects={projects}
      sidebarUsers={users}
    >
      {(error || modalError) && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error || modalError}
        </p>
      )}

      <DashboardHeader onRequestAiSuggestion={() => router.push('/tasks')} />

      <KpiGrid
        inProgressProjects={summary.inProgressProjects}
        completedSubs={summary.completedSubs}
        avgProgress={summary.avgProgress}
        weeklyMinutes={summary.weeklyMinutes}
        memberCount={users.length}
        loading={loading}
      />

      <TimerWidget
        candidates={timerCandidates}
        projectName={selectedProject?.name}
        helperText={timerHelperText}
      />

      <ProjectList
        projects={visibleProjects}
        subprojects={filteredSubprojects}
        loading={loading}
        selectedProjectId={selectedProjectId}
        onSelectProject={handleProjectSelect}
      />

      <CreateProjectModal
        open={createOpen}
        onClose={() => {
          setModalError('');
          setCreateOpen(false);
        }}
        onCreated={async (created) => {
          await reload();
          setSelectedMemberId(null);
          setSelectedProjectId(created.id);
        }}
        onError={setModalError}
      />
    </AppShell>
  );
}
