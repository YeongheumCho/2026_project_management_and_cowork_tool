'use client';

import Link from 'next/link';
import type { Project, SubProject } from '../../lib/api';
import {
  SUBPROJECT_STATUS_BADGE,
  SUBPROJECT_STATUS_LABEL,
} from '../../lib/subprojectStatus';
import { colorForId } from '../../components/AppShell/colors';

type Props = {
  project: Project;
  subprojects: SubProject[];
  selected?: boolean;
  onSelect?: (projectId: number) => void;
};

/**
 * 개요 페이지의 프로젝트 목록 한 행.
 *
 * - 좌측 컬러 도트 + 프로젝트명 + 요약 문구
 * - 우측: 진척도 막대 + 퍼센트 + 담당자 이니셜 배지 + 대표 상태 뱃지
 *
 * "대표 상태" 선정 규칙: 모두 completed 면 completed, 아니면 진행 중 중
 * 가장 진척률 높은 항목 기준. (주요 시각 지표만 단순하게)
 */
export default function ProjectListRow({
  project,
  subprojects,
  selected = false,
  onSelect,
}: Props) {
  const total = subprojects.length;
  const done = subprojects.filter((sp) => sp.status === 'completed').length;
  const avgProgress =
    total === 0
      ? 0
      : subprojects.reduce((acc, sp) => acc + sp.progress, 0) / total;

  const representative =
    total === 0
      ? null
      : subprojects.every((sp) => sp.status === 'completed')
        ? 'completed'
        : 'in_progress';

  // 담당자 이니셜 (중복 제거, 최대 4명)
  const assignees = Array.from(
    new Map(
      subprojects
        .filter((sp) => sp.assignee)
        .map((sp) => [sp.assignee!.id, sp.assignee!]),
    ).values(),
  ).slice(0, 4);

  const summary =
    subprojects
      .slice()
      .sort((left, right) => right.progress - left.progress)[0]?.name ??
    `소프로젝트 ${total}건 · 완료 ${done}건`;

  const containerClass = `flex w-full items-center gap-4 rounded-xl border bg-white p-4 text-left transition ${
    selected
      ? 'border-indigo-300 bg-indigo-50/40 shadow-sm'
      : 'border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/30'
  }`;

  const content = (
    <>
      <span
        className={`h-2.5 w-2.5 shrink-0 rounded-full ${colorForId(project.id)}`}
      />

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-900">
          {project.name}
        </p>
        <p className="mt-0.5 truncate text-xs text-slate-500">
          {summary}
        </p>
      </div>

      <div className="hidden w-64 shrink-0 items-center gap-3 md:flex">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-indigo-500"
            style={{ width: `${Math.min(100, Math.max(0, avgProgress))}%` }}
          />
        </div>
        <span className="w-10 shrink-0 text-right text-xs font-medium tabular-nums text-slate-600">
          {Math.round(avgProgress)}%
        </span>
      </div>

      <div className="hidden items-center gap-1 md:flex">
        {assignees.map((a) => (
          <span
            key={a.id}
            title={a.name}
            className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600"
          >
            {a.name.charAt(0)}
          </span>
        ))}
      </div>

      {representative && (
        <span
          className={`rounded-full px-2 py-0.5 text-micro ${SUBPROJECT_STATUS_BADGE[representative]}`}
        >
          {SUBPROJECT_STATUS_LABEL[representative]}
        </span>
      )}
    </>
  );

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
