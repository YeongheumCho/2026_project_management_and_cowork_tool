'use client';

import { useMemo, useState } from 'react';
import AppShell from '../components/AppShell';
import TeamModal from '../components/TeamModal';
import ConfirmDialog from '../components/ConfirmDialog';
import {
  apiFetch,
  type Project,
  type ProjectHistorySummary,
  type ProjectTimeSummary,
  type SubProject,
} from '../lib/api';
import { useMe } from '../lib/useMe';
import { useWorkflowSelection } from '../lib/workflow-selection';
import CreateProjectForm from './components/CreateProjectForm';
import ProjectCard from './components/ProjectCard';
import ProjectManageModal from './components/ProjectManageModal';
import CsvImportModal from './components/CsvImportModal';
import ProgressLogModal from './components/ProgressLogModal';
import VerifyTimeModal from './components/VerifyTimeModal';
import ProjectListToolbar, {
  EMPTY_PROJECT_LIST_FILTER,
  applyProjectListFilter,
  type ProjectListFilter,
} from './components/ProjectListToolbar';
import { useProjects } from './hooks/useProjects';
import { collectVehicleSuggestions } from './lib/vehicleSuggestions';

export default function ProjectsPage() {
  const { me, loading: meLoading } = useMe();
  const isAdmin = me?.role === 'admin';
  const { selectedMemberId, toggleSelectedMemberId } = useWorkflowSelection();

  const {
    projects,
    majorProjects,
    users,
    fieldSchemas,
    byProject,
    timeByProject,
    historyByProject,
    loading,
    error,
    reload,
    setError,
  } = useProjects(!!me);

  // 백엔드는 대프로젝트 멤버에게도 프로젝트 생성을 허용하므로 관리자 외에도 멤버십이 있으면 버튼을 보여준다.
  const canCreateProject = !!isAdmin || majorProjects.length > 0;

  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [createOpen, setCreateOpen] = useState(false);
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [projectInitial, setProjectInitial] = useState<Project | null>(null);
  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [csvProjectId, setCsvProjectId] = useState<number | undefined>();
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [modalProjectId, setModalProjectId] = useState<number | undefined>();
  const [modalInitial, setModalInitial] = useState<SubProject | null>(null);
  const [progressTarget, setProgressTarget] = useState<SubProject | null>(null);
  // B-73: 담당자별 검증 시간 기록 창
  const [timeTarget, setTimeTarget] = useState<SubProject | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [deletingProject, setDeletingProject] = useState(false);
  const [duplicateTarget, setDuplicateTarget] = useState<Project | null>(null);
  const [duplicatingProject, setDuplicatingProject] = useState(false);
  const [listFilter, setListFilter] = useState<ProjectListFilter>(EMPTY_PROJECT_LIST_FILTER);
  const visibleProjects = useMemo(
    () => applyProjectListFilter(projects, listFilter),
    [projects, listFilter],
  );
  const vehicleSuggestions = useMemo(
    () => collectVehicleSuggestions(projects, Array.from(byProject.values()).flat()),
    [projects, byProject],
  );
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

  const requestDeleteProject = (project: Project) => {
    if (!isAdmin) return;
    setDeleteTarget(project);
  };

  const requestDuplicateProject = (project: Project) => {
    if (!isAdmin) return;
    setDuplicateTarget(project);
  };

  const confirmDuplicateProject = async () => {
    const project = duplicateTarget;
    if (!isAdmin || !project) return;

    setDuplicatingProject(true);
    try {
      const created = await apiFetch<Project>(`/projects/${project.id}/duplicate`, {
        method: 'POST',
      });
      await reload();
      setExpanded((prev) => new Set(prev).add(created.id));
      setDuplicateTarget(null);
    } catch (nextError) {
      setError((nextError as Error).message);
    } finally {
      setDuplicatingProject(false);
    }
  };

  const confirmDeleteProject = async () => {
    const project = deleteTarget;
    if (!isAdmin || !project) return;

    setDeletingProject(true);
    try {
      await apiFetch<void>(`/projects/${project.id}`, { method: 'DELETE' });
      await reload();
      setExpanded((prev) => {
        const next = new Set(prev);
        next.delete(project.id);
        return next;
      });
      setDeleteTarget(null);
    } catch (nextError) {
      setError((nextError as Error).message);
    } finally {
      setDeletingProject(false);
    }
  };

  if (meLoading || !me) {
    return <main className="p-8 text-text">불러오는 중...</main>;
  }

  return (
    <AppShell
      me={me}
      selectedMemberId={selectedMemberId}
      onMemberSelect={toggleSelectedMemberId}
      onSubprojectSelect={setProgressTarget}
    >
      {error && (
        <p className="mb-4 rounded-lg bg-verify-fail-bg px-3 py-2 text-sm text-verify-fail-fg">
          {error}
        </p>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold tracking-[-0.3px] text-text">프로젝트</h1>
        {canCreateProject && (
          <button
            type="button"
            onClick={() => setCreateOpen((prev) => !prev)}
            aria-expanded={createOpen}
            className={`h-10 rounded-lg px-4 text-sm font-medium transition ${
              createOpen
                ? 'border border-border bg-white text-text-muted hover:bg-surface-muted'
                : 'bg-brand text-white hover:bg-brand-hover'
            }`}
          >
            {createOpen ? '프로젝트 추가 닫기' : '+ 프로젝트 추가'}
          </button>
        )}
      </div>

      {canCreateProject && createOpen && (
        <CreateProjectForm
          majorProjects={majorProjects}
          vehicleSuggestions={vehicleSuggestions}
          onCreated={async (created) => {
            await reload();
            setExpanded((prev) => new Set(prev).add(created.id));
            setCreateOpen(false);
          }}
          onError={setError}
          onCancel={() => setCreateOpen(false)}
        />
      )}

      {!loading && projects.length > 0 && (
        <ProjectListToolbar
          value={listFilter}
          onChange={setListFilter}
          projects={projects}
          majorProjects={majorProjects}
          visibleCount={visibleProjects.length}
        />
      )}

      <div className="space-y-4">
        {loading && (
          <p className="rounded-2xl border border-border bg-white p-8 text-center text-sm text-text-faint">
            프로젝트를 불러오는 중...
          </p>
        )}

        {!loading && projects.length === 0 && (
          <p className="rounded-2xl border border-border bg-white p-8 text-center text-sm text-text-faint">
            등록된 프로젝트가 없습니다.
            {canCreateProject ? ' 상단의 "+ 프로젝트 추가"로 첫 프로젝트를 생성해보세요.' : ''}
          </p>
        )}

        {!loading && projects.length > 0 && visibleProjects.length === 0 && (
          <div className="rounded-2xl border border-border bg-white p-8 text-center">
            <p className="text-sm text-text-muted">
              조건에 맞는 프로젝트가 없습니다. 전체 {projects.length}개 중 걸러진 결과입니다.
            </p>
            <button
              type="button"
              onClick={() => setListFilter(EMPTY_PROJECT_LIST_FILTER)}
              className="mt-3 rounded-lg border border-brand-soft bg-white px-3 py-1.5 text-micro font-bold text-brand transition hover:bg-brand-soft"
            >
              필터 초기화
            </button>
          </div>
        )}

        {visibleProjects.map((project) => (
          <ProjectCard
            key={project.id}
            project={project}
            subprojects={byProject.get(project.id) ?? []}
            timeSummary={timeByProject.get(project.id) ?? emptyTimeSummary(project.id)}
            historySummary={historyByProject.get(project.id) ?? emptyHistorySummary(project.id)}
            fieldSchemas={fieldSchemas}
            users={users}
            isAdmin={!!isAdmin}
            canManageSubprojects={canManageProjectSubprojects(project.id)}
            isOpen={expanded.has(project.id)}
            onToggle={toggleExpand}
            onAddSub={openCreateSub}
            onCsvImport={openCsvImport}
            onOpenSubProgress={openSubProject}
            onOpenSubTime={setTimeTarget}
            onEditSub={openEditSub}
            onEditProject={openEditProject}
            onDeleteProject={requestDeleteProject}
            onDuplicateProject={requestDuplicateProject}
          />
        ))}
      </div>

      <ProjectManageModal
        open={projectModalOpen}
        project={projectInitial}
        majorProjects={majorProjects}
        vehicleSuggestions={vehicleSuggestions}
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
        vehicleSuggestions={vehicleSuggestions}
        onClose={() => setModalOpen(false)}
        onSaved={reload}
      />

      <ProgressLogModal
        open={progressTarget !== null}
        subproject={progressTarget}
        onClose={() => setProgressTarget(null)}
        onSaved={reload}
      />

      <VerifyTimeModal
        open={timeTarget !== null}
        subproject={timeTarget}
        meId={me?.id ?? null}
        isAdmin={!!isAdmin}
        onClose={() => setTimeTarget(null)}
        onSaved={reload}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        title="프로젝트 삭제"
        description={
          deleteTarget
            ? `"${deleteTarget.name}" 프로젝트를 삭제하시겠습니까?\n하위 프로젝트도 함께 삭제됩니다.`
            : undefined
        }
        confirmLabel="삭제"
        variant="danger"
        busy={deletingProject}
        onConfirm={confirmDeleteProject}
        onClose={() => setDeleteTarget(null)}
      />

      <ConfirmDialog
        open={duplicateTarget !== null}
        title="프로젝트 복사"
        description={
          duplicateTarget
            ? `"${duplicateTarget.name}" 프로젝트를 "${duplicateTarget.name} (복사본)" 으로 복사합니다.\n참여 인원, 차종 세트, 하위 프로젝트(템플릿 값 포함)를 그대로 가져오고 진행률·수행 이력은 초기화됩니다.`
            : undefined
        }
        confirmLabel="복사"
        variant="primary"
        busy={duplicatingProject}
        onConfirm={confirmDuplicateProject}
        onClose={() => setDuplicateTarget(null)}
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
