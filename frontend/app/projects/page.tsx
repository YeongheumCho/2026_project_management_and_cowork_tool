'use client';

import { useMemo, useState } from 'react';
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
import CsvImportModal from './components/CsvImportModal';
import ProgressLogModal from './components/ProgressLogModal';
import { useProjects } from './hooks/useProjects';

export default function ProjectsPage() {
  const { me, loading: meLoading } = useMe();
  const isAdmin = me?.role === 'admin';

  const {
    projects,
    majorProjects,
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
  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [csvProjectId, setCsvProjectId] = useState<number | undefined>();
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [modalProjectId, setModalProjectId] = useState<number | undefined>();
  const [modalInitial, setModalInitial] = useState<SubProject | null>(null);
  const [progressTarget, setProgressTarget] = useState<SubProject | null>(null);
  const modalFunctionNameOptionsByLevel = useMemo(
    () => buildFunctionNameOptionsByLevel(byProject.get(modalProjectId ?? -1) ?? []),
    [byProject, modalProjectId],
  );

  const canManageProjectSubprojects = (projectId: number) => {
    if (isAdmin) return true;
    if (!me) return false;
    const project = projects.find((item) => item.id === projectId);
    return !!project?.participants.some((participant) => participant.id === me.id);
  };

  const toggleExpand = (id: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const openCreateSub = (projectId: number) => {
    if (!canManageProjectSubprojects(projectId)) return;
    setModalMode('create');
    setModalProjectId(projectId);
    setModalInitial(null);
    setModalOpen(true);
  };

  const openCsvImport = (projectId: number) => {
    if (!isAdmin) return;
    setCsvProjectId(projectId);
    setCsvModalOpen(true);
  };

  const openEditSub = (sp: SubProject) => {
    if (!canManageProjectSubprojects(sp.project_id)) return;
    setModalMode('edit');
    setModalProjectId(sp.project_id);
    setModalInitial(sp);
    setModalOpen(true);
  };

  const openSubProject = (sp: SubProject) => {
    setProgressTarget(sp);
  };

  const openEditProject = (project: Project) => {
    if (!isAdmin) return;
    setProjectInitial(project);
    setProjectModalOpen(true);
  };

  const handleDeleteProject = async (project: Project) => {
    if (!isAdmin) return;
    const ok = window.confirm(
      `"${project.name}" 프로젝트를 삭제하시겠습니까? 하위 프로젝트도 함께 삭제됩니다.`,
    );
    if (!ok) return;

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
    return <main className="p-8 text-text">불러오는 중...</main>;
  }

  return (
    <AppShell me={me} onSubprojectSelect={setProgressTarget}>
      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      <CreateProjectForm
        majorProjects={majorProjects}
        onCreated={async (created) => {
          await reload();
          setExpanded((prev) => new Set(prev).add(created.id));
        }}
        onError={setError}
      />

      <div className="space-y-4">
        {loading && (
          <p className="rounded-2xl border border-border bg-white p-8 text-center text-sm text-text-faint">
            프로젝트를 불러오는 중...
          </p>
        )}

        {!loading && projects.length === 0 && (
          <p className="rounded-2xl border border-border bg-white p-8 text-center text-sm text-text-faint">
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
            canManageSubprojects={canManageProjectSubprojects(project.id)}
            isOpen={expanded.has(project.id)}
            onToggle={toggleExpand}
            onAddSub={openCreateSub}
            onCsvImport={openCsvImport}
            onOpenSubProgress={openSubProject}
            onEditSub={openEditSub}
            onEditProject={openEditProject}
            onDeleteProject={handleDeleteProject}
          />
        ))}
      </div>

      <ProjectManageModal
        open={projectModalOpen}
        project={projectInitial}
        majorProjects={majorProjects}
        onClose={() => {
          setProjectModalOpen(false);
          setProjectInitial(null);
        }}
        onSaved={reload}
        onError={setError}
      />

      <CsvImportModal
        open={csvModalOpen}
        project={projects.find((project) => project.id === csvProjectId) ?? null}
        users={users}
        onClose={() => setCsvModalOpen(false)}
        onImported={reload}
      />

      <TeamModal
        open={modalOpen}
        mode={modalMode}
        isAdmin={
          modalProjectId != null
            ? canManageProjectSubprojects(modalProjectId)
            : !!isAdmin
        }
        canDelete={!!isAdmin}
        users={users}
        projects={projects}
        lockedProjectId={modalMode === 'create' ? modalProjectId : undefined}
        initial={modalInitial}
        functionNameOptionsByLevel={modalFunctionNameOptionsByLevel}
        onClose={() => setModalOpen(false)}
        onSaved={reload}
      />

      <ProgressLogModal
        open={progressTarget !== null}
        subproject={progressTarget}
        onClose={() => setProgressTarget(null)}
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

function buildFunctionNameOptionsByLevel(subprojects: SubProject[]) {
  const grouped = new Map<string, Set<string>>();
  for (const subproject of subprojects) {
    const level = subproject.verification_level?.trim();
    const functionName = (subproject.function_name || subproject.name).trim();
    if (!level || !functionName) continue;
    const names = grouped.get(level) ?? new Set<string>();
    names.add(functionName);
    grouped.set(level, names);
  }

  return Object.fromEntries(
    [...grouped.entries()].map(([level, names]) => [
      level,
      [...names].sort((left, right) => left.localeCompare(right, 'ko-KR')),
    ]),
  );
}
