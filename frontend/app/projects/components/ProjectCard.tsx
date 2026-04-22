'use client';

import {
  PROJECT_TYPE_LABEL,
  type Project,
  type SubProject,
} from '../../lib/api';
import SubProjectListItem from './SubProjectListItem';

type Props = {
  project: Project;
  subprojects: SubProject[];
  isAdmin: boolean;
  isOpen: boolean;
  onToggle: (projectId: number) => void;
  onAddSub: (projectId: number) => void;
  onEditSub: (sp: SubProject) => void;
};

/**
 * 프로젝트 단위 카드 — 헤더(요약 + 추가 버튼) + 펼쳐진 상태의 소프로젝트 목록.
 */
export default function ProjectCard({
  project,
  subprojects,
  isAdmin,
  isOpen,
  onToggle,
  onAddSub,
  onEditSub,
}: Props) {
  const total = subprojects.length;
  const done = subprojects.filter((sp) => sp.status === 'completed').length;
  const typeLabel =
    PROJECT_TYPE_LABEL[project.project_type] ?? project.project_type;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="flex flex-wrap items-center gap-3 p-4">
        <button
          onClick={() => onToggle(project.id)}
          className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-xs text-slate-500 hover:bg-slate-50"
          aria-label={isOpen ? '접기' : '펼치기'}
        >
          {isOpen ? '−' : '+'}
        </button>
        <div className="flex-1 min-w-[160px]">
          <p className="text-base font-semibold">
            {project.name}
            <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-micro text-slate-600">
              {typeLabel}
            </span>
          </p>
          <p className="text-micro text-slate-500">
            생성 {new Date(project.created_at).toLocaleDateString('ko-KR')} ·
            소프로젝트 {total}건 (완료 {done})
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => onAddSub(project.id)}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            + 소프로젝트 추가
          </button>
        )}
      </header>

      {isOpen && (
        <div className="border-t border-slate-100 bg-slate-50/40 p-4">
          {subprojects.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-400">
              아직 소프로젝트가 없습니다.
              {isAdmin &&
                ' 위의 [+ 소프로젝트 추가] 버튼으로 만들 수 있어요.'}
            </p>
          ) : (
            <ul className="space-y-2">
              {subprojects.map((sp) => (
                <SubProjectListItem
                  key={sp.id}
                  sp={sp}
                  onClick={onEditSub}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
