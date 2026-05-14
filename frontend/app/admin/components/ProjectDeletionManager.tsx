'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch, type Project } from '../../lib/api';

type Props = {
  enabled: boolean;
};

export default function ProjectDeletionManager({ enabled }: Props) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const sortedProjects = useMemo(
    () =>
      [...projects].sort((left, right) =>
        right.created_at.localeCompare(left.created_at),
      ),
    [projects],
  );

  const load = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const nextProjects = await apiFetch<Project[]>('/projects');
      setProjects(nextProjects);
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
    <section className="rounded-2xl border border-[#EAEAE4] bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-heading font-bold text-[#1A1A1A]">
            프로젝트 삭제 관리
          </h3>
          <p className="mt-1 text-small text-[#888780]">
            대프로젝트에 속한 개별 프로젝트 삭제를 한 곳에서 처리합니다.
          </p>
        </div>
      </div>

      {message && (
        <p className="mt-4 rounded-xl bg-[#FAFAFA] px-4 py-3 text-sm text-[#5F5E5A]">
          {message}
        </p>
      )}

      <div className="mt-4 overflow-hidden rounded-xl border border-[#EAEAE4]">
        {loading ? (
          <p className="px-4 py-6 text-center text-sm text-[#888780]">
            프로젝트를 불러오는 중...
          </p>
        ) : sortedProjects.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-[#888780]">
            삭제할 프로젝트가 없습니다.
          </p>
        ) : (
          <div className="divide-y divide-[#F1EFE8]">
            {sortedProjects.map((project) => (
              <div
                key={project.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-body font-semibold text-[#1A1A1A]">
                    {project.name}
                  </p>
                  <p className="mt-0.5 text-micro text-[#888780]">
                    하위 {project.subproject_count}건 · 참여 {project.participants.length}명 · 진행률 {Math.round(project.progress_percent)}%
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void deleteProject(project)}
                  disabled={deletingId === project.id}
                  className="rounded-lg border border-[#F4C9C9] px-3 py-1.5 text-micro font-bold text-[#A32D2D] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {deletingId === project.id ? '삭제 중...' : '삭제'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
