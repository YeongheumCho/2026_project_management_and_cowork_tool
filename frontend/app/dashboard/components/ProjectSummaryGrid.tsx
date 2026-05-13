'use client';

import Link from 'next/link';
import type { Project, SubProject } from '../../lib/api';
import { PROJECT_TYPE_LABEL } from '../../lib/api';
import { colorForId } from '../../components/AppShell/colors';
import ProgressBar from '../../components/ProgressBar';

type Props = {
  projects: Project[];
  subprojects: SubProject[];
  loading?: boolean;
};

/**
 * 대시보드 상단의 "등록된 프로젝트" 요약 카드 그리드.
 *
 * 각 카드는 프로젝트 이름, 유형, 평균 진행률, 담당자 수, 소프로젝트 개수를
 * 한눈에 보여준다. 카드를 클릭하면 /projects 로 이동해 해당 프로젝트의
 * 전체 상세(소프로젝트 목록 포함)를 확인할 수 있다.
 */
export default function ProjectSummaryGrid({
  projects,
  subprojects,
  loading,
}: Props) {
  const byProject = new Map<number, SubProject[]>();
  for (const sp of subprojects) {
    const list = byProject.get(sp.project_id) ?? [];
    list.push(sp);
    byProject.set(sp.project_id, list);
  }

  return (
    <section className="mt-6">
      <div className="mb-3 flex items-end justify-between">
        <div>
          <h2 className="text-heading font-bold text-[#1A1A1A]">
            등록된 프로젝트
          </h2>
          <p className="mt-0.5 text-micro text-[#888780]">
            카드를 클릭하면 프로젝트별 상세로 이동합니다.
          </p>
        </div>
        <Link
          href="/projects"
          className="text-micro font-semibold text-[#534AB7] hover:underline"
        >
          전체 보기 →
        </Link>
      </div>

      {loading ? (
        <p className="rounded-2xl border border-[#EAEAE4] bg-white p-8 text-center text-small text-[#888780]">
          불러오는 중...
        </p>
      ) : projects.length === 0 ? (
        <p className="rounded-2xl border border-[#EAEAE4] bg-white p-8 text-center text-small text-[#888780]">
          등록된 프로젝트가 없습니다.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => {
            const related = byProject.get(project.id) ?? [];
            const assigneeIds = new Set(
              related.flatMap((sp) =>
                sp.assignee_ids.length
                  ? sp.assignee_ids
                  : sp.assignee_id == null
                    ? []
                    : [sp.assignee_id],
              ),
            );
            const avgProgress = Math.round(project.progress_percent ?? 0);
            const doneCount = project.completed_subproject_count ?? related.filter(
              (sp) => sp.status === 'completed',
            ).length;
            const subprojectCount = project.subproject_count ?? related.length;
            const typeLabel =
              PROJECT_TYPE_LABEL[project.project_type] ?? project.project_type;

            return (
              <Link
                key={project.id}
                href={`/projects`}
                className="group flex flex-col gap-2 rounded-2xl border border-[#EAEAE4] bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-[#D3D1C7] hover:shadow-md"
              >
                <div className="flex items-start gap-2">
                  <span
                    className={`mt-1 h-[9px] w-[9px] shrink-0 rounded-full ${colorForId(project.id)}`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-body font-semibold text-[#1A1A1A] group-hover:text-[#534AB7]">
                      {project.name}
                    </p>
                    <p className="mt-0.5 text-tiny text-[#888780]">
                      {typeLabel}
                    </p>
                  </div>
                </div>

                <div className="mt-1">
                  <div className="flex items-center justify-between text-tiny text-[#888780]">
                    <span>진행률</span>
                    <span className="font-semibold text-[#1A1A1A]">
                      {avgProgress}%
                    </span>
                  </div>
                  <ProgressBar value={avgProgress} className="mt-1 h-1.5" />
                </div>

                <div className="mt-auto flex items-center gap-3 pt-2 text-tiny text-[#888780]">
                  <span className="inline-flex items-center gap-1">
                    <span className="font-semibold text-[#1A1A1A]">
                      {subprojectCount}
                    </span>
                    소프로젝트
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="font-semibold text-[#1A1A1A]">
                      {doneCount}
                    </span>
                    완료
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="font-semibold text-[#1A1A1A]">
                      {assigneeIds.size}
                    </span>
                    명 담당
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
