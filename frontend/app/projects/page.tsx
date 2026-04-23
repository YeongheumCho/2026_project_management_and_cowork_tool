'use client';

import { useState } from 'react';
import AppShell from '../components/AppShell';
import TeamModal from '../components/TeamModal';
import { type ProjectTimeSummary, type SubProject } from '../lib/api';
import { useMe } from '../lib/useMe';
import CreateProjectForm from './components/CreateProjectForm';
import ProjectCard from './components/ProjectCard';
import { useProjects } from './hooks/useProjects';

export default function ProjectsPage() {
  const { me, loading: meLoading } = useMe();
  const isAdmin = me?.role === 'admin';

  const {
    projects,
    users,
    byProject,
    timeByProject,
    loading,
    error,
    reload,
    setError,
  } = useProjects(!!me);

  const [expanded, setExpanded] = useState<Set<number>>(new Set());
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
    setModalMode('edit');
    setModalProjectId(sp.project_id);
    setModalInitial(sp);
    setModalOpen(true);
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
            isAdmin={!!isAdmin}
            isOpen={expanded.has(project.id)}
            onToggle={toggleExpand}
            onAddSub={openCreateSub}
            onEditSub={openEditSub}
          />
        ))}
      </div>

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
