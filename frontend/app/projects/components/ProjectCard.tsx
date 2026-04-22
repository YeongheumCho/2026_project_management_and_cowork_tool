'use client';

import { PROJECT_TYPE_LABEL, type Project, type SubProject } from '../../lib/api';
import ProgressBar from '../../components/ProgressBar';
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
  const inProgress = subprojects.filter((sp) => sp.status === 'in_progress').length;
  const progress = total > 0 ? (done / total) * 100 : 0;
  const typeLabel =
    PROJECT_TYPE_LABEL[project.project_type] ?? project.project_type;

  return (
    <section className="overflow-hidden rounded-[24px] border border-[#E7E5DD] bg-white shadow-[0_14px_40px_rgba(28,25,23,0.06)]">
      <header className="border-b border-[#F0EEE7] px-5 py-4">
        <div className="flex flex-wrap items-start gap-3">
          <button
            type="button"
            onClick={() => onToggle(project.id)}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#DDDAD0] bg-[#FAFAF7] text-sm font-semibold text-[#5F5E5A] transition hover:border-[#BDB8E9] hover:text-[#534AB7]"
            aria-label={isOpen ? 'Collapse project' : 'Expand project'}
          >
            {isOpen ? '-' : '+'}
          </button>

          <div className="min-w-[220px] flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[#6D61FF]" />
              <h3 className="text-[17px] font-semibold tracking-[-0.02em] text-[#1D1D1B]">
                {project.name}
              </h3>
              <span className="rounded-full border border-[#E5E2FF] bg-[#F5F3FF] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[#534AB7]">
                {typeLabel}
              </span>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[#7A786F]">
              <span>
                Created {new Date(project.created_at).toLocaleDateString('ko-KR')}
              </span>
              <span>{total} subprojects</span>
              <span>{done} completed</span>
              <span>{inProgress} in progress</span>
            </div>
          </div>

          <div className="min-w-[180px] flex-1 rounded-[18px] border border-[#F0EEE7] bg-[#FCFCFA] px-4 py-3">
            <div className="flex items-center justify-between text-[11px] font-semibold text-[#5F5E5A]">
              <span>Project progress</span>
              <span className="text-[#1D1D1B]">{Math.round(progress)}%</span>
            </div>
            <ProgressBar
              value={progress}
              className="mt-2"
              ariaLabel={`${project.name} progress`}
            />
          </div>

          {isAdmin && (
            <button
              type="button"
              onClick={() => onAddSub(project.id)}
              className="rounded-[14px] bg-[#534AB7] px-4 py-2 text-[11px] font-bold text-white shadow-[0_8px_20px_rgba(83,74,183,0.24)] transition hover:bg-[#473EA7]"
            >
              + Add subproject
            </button>
          )}
        </div>
      </header>

      {isOpen && (
        <div className="bg-[#FBFBF8] px-5 py-5">
          {subprojects.length === 0 ? (
            <p className="rounded-[18px] border border-dashed border-[#D7D4CA] bg-white px-5 py-8 text-center text-sm text-[#8B897F]">
              No subprojects yet.
              {isAdmin ? ' Add one from the button above to get started.' : ''}
            </p>
          ) : (
            <ul className="space-y-3">
              {subprojects.map((sp) => (
                <SubProjectListItem key={sp.id} sp={sp} onClick={onEditSub} />
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
