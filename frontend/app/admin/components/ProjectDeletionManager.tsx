'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch, type MajorProject, type Project } from '../../lib/api';
import ProjectManageModal from '../../projects/components/ProjectManageModal';

type Props = {
  enabled: boolean;
};

type MajorProjectTab = number | 'unassigned' | null;

export default function ProjectDeletionManager({ enabled }: Props) {
  const [majorProjects, setMajorProjects] = useState<MajorProject[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeMajorProjectId, setActiveMajorProjectId] = useState<MajorProjectTab>(null);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const sortedMajorProjects = useMemo(
    () =>
      [...majorProjects].sort((left, right) =>
        left.name.localeCompare(right.name, 'ko-KR'),
      ),
    [majorProjects],
  );

  const hasUnassignedProjects = useMemo(
    () => projects.some((project) => project.major_project_id == null),
    [projects],
  );

  const sortedProjects = useMemo(
    () =>
      projects
        .filter((project) => {
          if (activeMajorProjectId === null) return true;
          if (activeMajorProjectId === 'unassigned') {
            return project.major_project_id == null;
          }
          return project.major_project_id === activeMajorProjectId;
        })
        .sort((left, right) => right.created_at.localeCompare(left.created_at)),
    [activeMajorProjectId, projects],
  );

  const activeMajorProject = useMemo(
    () =>
      typeof activeMajorProjectId === 'number'
        ? majorProjects.find((project) => project.id === activeMajorProjectId) ?? null
        : null,
    [activeMajorProjectId, majorProjects],
  );

  const activeTitle =
    activeMajorProject?.name ??
    (activeMajorProjectId === 'unassigned' ? '대프로젝트 미분류' : '프로젝트');

  const load = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const [nextMajorProjects, nextProjects] = await Promise.all([
        apiFetch<MajorProject[]>('/major-projects'),
        apiFetch<Project[]>('/projects'),
      ]);

      setMajorProjects(nextMajorProjects);
      setProjects(nextProjects);
      setActiveMajorProjectId((current) => {
        if (
          typeof current === 'number' &&
          nextMajorProjects.some((majorProject) => majorProject.id === current)
        ) {
          return current;
        }
        if (
          current === 'unassigned' &&
          nextProjects.some((project) => project.major_project_id == null)
        ) {
          return current;
        }
        return (
          nextMajorProjects[0]?.id ??
          (nextProjects.some((project) => project.major_project_id == null)
            ? 'unassigned'
            : null)
        );
      });
      setMessage('');
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void load();
  }, [load]);

  async function deleteProject(project: Project) {
    if (
      !window.confirm(
        `"${project.name}" 프로젝트를 삭제할까요? 하위 프로젝트와 기록도 함께 삭제됩니다.`,
      )
    ) {
      return;
    }

    setDeletingId(project.id);
    setMessage('');
    try {
      await apiFetch<void>(`/projects/${project.id}`, { method: 'DELETE' });
      setProjects((current) => current.filter((item) => item.id !== project.id));
      setMessage('프로젝트를 삭제했습니다.');
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-heading font-bold text-text">
            프로젝트 수정 및 삭제 관리
          </h3>
          <p className="mt-1 text-small text-text-subtle">
            대프로젝트를 선택한 뒤 해당 대프로젝트에 속한 프로젝트만 수정하거나 삭제합니다.
          </p>
        </div>
      </div>

      {message && (
        <p className="mt-4 rounded-xl bg-surface-muted px-4 py-3 text-sm text-text-muted">
          {message}
        </p>
      )}

      {!loading && (sortedMajorProjects.length > 0 || hasUnassignedProjects) && (
        <div className="mt-4 flex flex-wrap gap-2">
          {sortedMajorProjects.map((majorProject) => (
            <button
              key={majorProject.id}
              type="button"
              onClick={() => setActiveMajorProjectId(majorProject.id)}
              className={`rounded-lg border px-3 py-2 text-small font-bold transition ${
                activeMajorProjectId === majorProject.id
                  ? 'border-brand bg-brand text-white'
                  : 'border-border bg-white text-text-muted hover:border-brand hover:text-brand'
              }`}
            >
              {majorProject.name}
            </button>
          ))}
          {hasUnassignedProjects && (
            <button
              type="button"
              onClick={() => setActiveMajorProjectId('unassigned')}
              className={`rounded-lg border px-3 py-2 text-small font-bold transition ${
                activeMajorProjectId === 'unassigned'
                  ? 'border-brand bg-brand text-white'
                  : 'border-border bg-white text-text-muted hover:border-brand hover:text-brand'
              }`}
            >
              미분류
            </button>
          )}
        </div>
      )}

      <div className="mt-4 overflow-hidden rounded-xl border border-border">
        {loading ? (
          <p className="px-4 py-6 text-center text-sm text-text-subtle">
            프로젝트를 불러오는 중...
          </p>
        ) : sortedProjects.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-text-subtle">
            {activeTitle}에 등록된 프로젝트가 없습니다.
          </p>
        ) : (
          <div className="divide-y divide-surface-subtle">
            <div className="bg-surface-muted px-4 py-3 text-small font-bold text-text">
              {activeTitle} · {sortedProjects.length}건
            </div>
            {sortedProjects.map((project) => (
              <div
                key={project.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-body font-semibold text-text">
                    {project.name}
                  </p>
                  <p className="mt-0.5 text-micro text-text-subtle">
                    하위 {project.subproject_count}건 · 참여 {project.participants.length}명 · 진행률 {Math.round(project.progress_percent)}%
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingProject(project)}
                    className="rounded-lg border border-brand-soft px-3 py-1.5 text-micro font-bold text-brand hover:bg-brand-soft"
                  >
                    수정
                  </button>
                  <button
                    type="button"
                    onClick={() => void deleteProject(project)}
                    disabled={deletingId === project.id}
                    className="rounded-lg border border-verify-fail-bg px-3 py-1.5 text-micro font-bold text-verify-fail-fg disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {deletingId === project.id ? '삭제 중...' : '삭제'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ProjectManageModal
        open={editingProject !== null}
        project={editingProject}
        majorProjects={majorProjects}
        onClose={() => setEditingProject(null)}
        onSaved={load}
        onError={setMessage}
      />
    </section>
  );
}
