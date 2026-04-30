'use client';

import Link from 'next/link';
import type { Project, SubProject } from '../../lib/api';
import {
  colorForId,
  softColorForId,
  textColorForId,
} from '../../components/AppShell/colors';

type Props = {
  project: Project;
  subprojects: SubProject[];
  selected?: boolean;
  onSelect?: (projectId: number) => void;
};

export default function ProjectListRow({
  project,
  subprojects,
  selected = false,
  onSelect,
}: Props) {
  const total = project.subproject_count ?? subprojects.length;
  const done =
    project.completed_subproject_count ??
    subprojects.filter((subproject) => subproject.status === 'completed').length;
  const progress = project.progress_percent ?? 0;
  const summary = `소프로젝트 ${total}건 · 완료 ${done}건`;

  const assignees = Array.from(
    new Map(
      (subprojects.length > 0
        ? subprojects
            .filter((subproject) => subproject.assignee)
            .map((subproject) => [
              subproject.assignee!.id,
              subproject.assignee!,
            ])
        : project.participants.map((member) => [
            member.id,
            { id: member.id, name: member.name },
          ])),
    ).values(),
  ).slice(0, 4);

  const content = (
    <>
      <span
        className={`h-[9px] w-[9px] shrink-0 rounded-full ${colorForId(project.id)}`}
      />

      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold text-[#1A1A1A]">
          {project.name}
        </p>
        <p className="mt-0.5 truncate text-[11px] text-[#888780]">{summary}</p>
      </div>

      <div className="hidden w-[90px] shrink-0 md:block">
        <div className="h-1 overflow-hidden rounded-full bg-[#F1EFE8]">
          <div
            className={`h-full rounded-full ${colorForId(project.id)}`}
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
        <div className="mt-[3px] text-right text-[10px] text-[#888780]">
          {Math.round(progress)}%
        </div>
      </div>

      <div className="hidden items-center md:flex">
        {assignees.map((assignee, index) => (
          <span
            key={assignee.id}
            title={assignee.name}
            className={`flex h-[22px] w-[22px] items-center justify-center rounded-full border-2 border-white text-[8px] font-bold ${softColorForId(assignee.id)} ${textColorForId(assignee.id)}`}
            style={{ marginLeft: index === 0 ? 0 : -6 }}
          >
            {assignee.name.charAt(0)}
          </span>
        ))}
      </div>

      <span className="rounded-[10px] bg-[#E6F1FB] px-[9px] py-[3px] text-[10px] font-bold uppercase tracking-[0.5px] text-[#185FA5]">
        {progress >= 100 ? '완료' : '진행중'}
      </span>
    </>
  );

  const containerClass = `flex w-full items-center gap-[14px] rounded-xl border px-4 py-[13px] text-left transition ${
    selected
      ? 'border-[#D3D1C7] bg-[#FAFAFA]'
      : 'border-[#EAEAE4] bg-white hover:border-[#D3D1C7] hover:bg-[#FAFAFA]'
  }`;

  if (onSelect) {
    return (
      <button
        type="button"
        onClick={() => onSelect(project.id)}
        className={containerClass}
      >
        {content}
      </button>
    );
  }

  return (
    <Link href={`/projects/${project.id}`} className={containerClass}>
      {content}
    </Link>
  );
}
