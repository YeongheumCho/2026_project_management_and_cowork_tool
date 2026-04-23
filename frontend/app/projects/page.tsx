'use client';

import { useState } from 'react';
import AppShell from '../components/AppShell';
import TeamModal from '../components/TeamModal';
import {
  apiFetch,
  type Project,
  type ProjectHistorySummary,
  type ProjectTimeSummary,
  type SubProject,
} from '../lib/api';
import { useMe } from '../lib/useMe';
import CreateProjectForm from './components/CreateProjectForm';
import ProjectCard from './components/ProjectCard';
import ProjectManageModal from './components/ProjectManageModal';
import { useProjects } from './hooks/useProjects';

export default function ProjectsPage() {
  const { me, loading: meLoading } = useMe();
  const isAdmin = me?.role === 'admin';

  const {
    projects,
    users,
    byProject,
    timeByProject,
    historyByProject,
    loading,
    error,
    reload,
    setError,
  } = useProjects(!!me);

  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [projectInitial, setProjectInitial] = useState<Project | null>(null);

  const toggleExpand = (id: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [modalProjectId, setModalProjectId] = useState<number | undefined>();
  const [modalInitial, setModalInitial] = useState<SubProject | null>(null);

  const openCreateSub = (projectId: number) => {
    if (!isAdmin) return;
    setModalMode('create');
    setModalProjectId(projectId);
    setModalInitial(null);
    setModalOpen(true);
  };

  const openEditSub = (sp: SubProject) => {
    if (!isAdmin) return;
    setModalMode('edit');
    setModalProjectId(sp.project_id);
    setModalInitial(sp);
    setModalOpen(true);
  };

  const openEditProject = (project: Project) => {
    if (!isAdmin) return;
    setProjectInitial(project);
    setProjectModalOpen(true);
  };

  const handleDeleteProject = async (project: Project) => {
    if (!isAdmin) return;
    if (
      !window.confirm(
        `"${project.name}" 프로젝트를 삭제하시겠습니까? 하위 프로젝트도 함께 삭제됩니다.`,
      )
    ) {
      return;
    }

    try {
      await apiFetch<void>(`/projects/${project.id}`, { method: 'DELETE' });
      await reload();
      setExpanded((prev) => {
        const next = new Set(prev);
        next.delete(project.id);
        return next;
      });
    } catch (nextError) {
      setError((nextError as Error).message);
    }
  };

  if (meLoading || !me) {
    return <main className="p-8 text-slate-900">불러오는 중...</main>;
  }

  return (
    <AppShell me={me}>
      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      {isAdmin && (
        <CreateProjectForm
          users={users}
          onCreated={async (created) => {
            await reload();
            setExpanded((prev) => new Set(prev).add(created.id));
          }}
          onError={setError}
        />
      )}

      <div className="space-y-4">
        {loading && (
          <p className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">
            프로젝트를 불러오는 중...
          </p>
        )}

        {!loading && projects.length === 0 && (
          <p className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">
            등록된 프로젝트가 없습니다.
            {isAdmin ? ' 상단에서 첫 프로젝트를 생성해보세요.' : ''}
          </p>
        )}

        {projects.map((project) => (
          <ProjectCard
            key={project.id}
            project={project}
            subprojects={byProject.get(project.id) ?? []}
            timeSummary={timeByProject.get(project.id) ?? emptyTimeSummary(project.id)}
            historySummary={historyByProject.get(project.id) ?? emptyHistorySummary(project.id)}
            isAdmin={!!isAdmin}
            isOpen={expanded.has(project.id)}
            onToggle={toggleExpand}
            onAddSub={openCreateSub}
            onEditSub={openEditSub}
            onEditProject={openEditProject}
            onDeleteProject={handleDeleteProject}
          />
        ))}
      </div>

      <ProjectManageModal
        open={projectModalOpen}
        project={projectInitial}
        users={users}
        onClose={() => {
          setProjectModalOpen(false);
          setProjectInitial(null);
        }}
        onSaved={reload}
        onError={setError}
      />

      <TeamModal
        open={modalOpen}
        mode={modalMode}
        isAdmin={!!isAdmin}
        users={users}
        projects={projects}
        lockedProjectId={modalMode === 'create' ? modalProjectId : undefined}
        initial={modalInitial}
        onClose={() => setModalOpen(false)}
        onSaved={reload}
      />
    </AppShell>
  );
}

function emptyTimeSummary(projectId: number): ProjectTimeSummary {
  return {
    project_id: projectId,
    total_seconds: 0,
    members: [],
  };
}

function emptyHistorySummary(projectId: number): ProjectHistorySummary {
  return {
    project_id: projectId,
    total_completed_count: 0,
    members: [],
  };
}
