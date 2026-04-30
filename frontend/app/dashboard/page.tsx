'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '../components/AppShell';
import { useMe } from '../lib/useMe';
import CreateProjectModal from '../projects/components/CreateProjectModal';
import { useWorkflowSelection } from '../lib/workflow-selection';
import DashboardHeader from './components/DashboardHeader';
import KpiGrid from './components/KpiGrid';
import ProjectList from './components/ProjectList';
import ProjectSummaryGrid from './components/ProjectSummaryGrid';
import TimerWidget from './components/TimerWidget';
import { useDashboardData } from './hooks/useDashboardData';

export default function DashboardPage() {
  const router = useRouter();
  const { me, loading: meLoading } = useMe();
  const {
    selectedMemberId,
    setSelectedMemberId,
    toggleSelectedMemberId,
    selectedProjectId,
    setSelectedProjectId,
  } = useWorkflowSelection();
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

  const isAdmin = me?.role === 'admin';
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
    const assignedProjectIds = new Set(
      filteredSubprojects.map((subproject) => subproject.project_id),
    );
    return projects.filter(
      (project) =>
        assignedProjectIds.has(project.id) ||
        project.participants.some((member) => member.id === selectedMemberId),
    );
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
  }, [selectedProjectId, setSelectedProjectId, visibleProjects]);

  const selectedProject = useMemo(
    () =>
      visibleProjects.find((project) => project.id === selectedProjectId) ?? null,
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
      return '선택한 담당자에게 해당되는 프로젝트가 없습니다.';
    }
    if (!selectedProject) {
      return '왼쪽에서 프로젝트를 선택해 주세요.';
    }
    if (selectedMemberId) {
      return '선택한 담당자 기준으로 현재 진행 중인 업무만 보여드립니다.';
    }
    return '프로젝트를 선택하고 작업을 시작해 보세요.';
  }, [selectedMemberId, selectedProject]);

  const handleProjectSelect = (projectId: number) => {
    const hasVisibleTask = filteredSubprojects.some(
      (subproject) => subproject.project_id === projectId,
    );
    const hasVisibleProject = projects.some(
      (project) =>
        project.id === projectId &&
        project.participants.some((member) => member.id === selectedMemberId),
    );
    if (selectedMemberId && !hasVisibleTask && !hasVisibleProject) {
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
        isAdmin
          ? () => {
              setModalError('');
              setCreateOpen(true);
            }
          : undefined
      }
      selectedProjectId={selectedProjectId}
      selectedMemberId={selectedMemberId}
      onProjectSelect={handleProjectSelect}
      onMemberSelect={toggleSelectedMemberId}
      sidebarProjects={projects}
      sidebarUsers={users}
    >
      {(error || modalError) && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error || modalError}
        </p>
      )}

      <DashboardHeader
        onRequestAiSuggestion={
          isAdmin ? () => router.push('/tasks') : undefined
        }
      />

      <KpiGrid
        inProgressProjects={summary.inProgressProjects}
        completedSubs={summary.completedSubs}
        avgProgress={summary.avgProgress}
        weeklyMinutes={summary.weeklyMinutes}
        memberCount={users.length}
        loading={loading}
      />

      <ProjectSummaryGrid
        projects={projects}
        subprojects={subprojects}
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
        users={users}
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
