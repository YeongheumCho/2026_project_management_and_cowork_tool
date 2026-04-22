'use client';

import type { Project, SubProject } from '../../lib/api';
import ProjectListRow from './ProjectListRow';

type Props = {
  projects: Project[];
  subprojects: SubProject[];
  loading: boolean;
};

/**
 * 개요 페이지 하단 "프로젝트 목록" 섹션.
 * 각 행(ProjectListRow)은 독립 파일이라 행 단위 변경이 섹션 래퍼 레이아웃과
 * 충돌하지 않도록 분리되어 있다.
 */
export default function ProjectList({
  projects,
  subprojects,
  loading,
}: Props) {
  const byProject = new Map<number, SubProject[]>();
  for (const sp of subprojects) {
    const arr = byProject.get(sp.project_id) ?? [];
    arr.push(sp);
    byProject.set(sp.project_id, arr);
  }

  return (
    <section className="mt-6">
      <h2 className="mb-3 text-lg font-semibold text-slate-900">프로젝트 목록</h2>

      <div className="space-y-2">
        {loading && (
          <p className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">
            불러오는 중...
          </p>
        )}

        {!loading && projects.length === 0 && (
          <p className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">
            아직 프로젝트가 없습니다.
          </p>
        )}

        {!loading &&
          projects.map((p) => (
            <ProjectListRow
              key={p.id}
              project={p}
              subprojects={byProject.get(p.id) ?? []}
            />
          ))}
      </div>
    </section>
  );
}
