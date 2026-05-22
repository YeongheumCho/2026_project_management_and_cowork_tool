'use client';

import type { ReactNode } from 'react';
import {
  PROJECT_TYPE_LABEL,
  type Project,
  type ProjectHistorySummary,
  type ProjectTimeSummary,
  type SubProject,
} from '../../lib/api';
import ProgressBar from '../../components/ProgressBar';
import { colorForId } from '../../components/AppShell/colors';
import SubProjectListItem from './SubProjectListItem';

type Props = {
  project: Project;
  subprojects: SubProject[];
  timeSummary: ProjectTimeSummary;
  historySummary: ProjectHistorySummary;
  isAdmin: boolean;
  isOpen: boolean;
  onToggle: (projectId: number) => void;
  onAddSub: (projectId: number) => void;
  onCsvImport: (projectId: number) => void;
  onOpenSubProgress: (sp: SubProject) => void;
  onEditSub: (sp: SubProject) => void;
  onEditProject: (project: Project) => void;
  onDeleteProject: (project: Project) => void;
};

export default function ProjectCard({
  project,
  subprojects,
  timeSummary,
  historySummary,
  isAdmin,
  isOpen,
  onToggle,
  onAddSub,
  onCsvImport,
  onOpenSubProgress,
  onEditSub,
  onEditProject,
  onDeleteProject,
}: Props) {
  const total = project.subproject_count ?? subprojects.length;
  const done =
    project.completed_subproject_count ??
    subprojects.filter((sp) => sp.status === 'completed').length;
  const inProgress =
    project.in_progress_subproject_count ??
    subprojects.filter((sp) => sp.status === 'in_progress').length;
  const progress = project.progress_percent ?? 0;
  const isCompleted = total > 0 && done >= total;
  const typeLabel = PROJECT_TYPE_LABEL[project.project_type] ?? project.project_type;
  const topMembers = timeSummary.members.slice(0, 5);
  const topHistoryMembers = historySummary.members.slice(0, 5);
  const periodLabel =
    project.start_date && project.end_date
      ? `${project.start_date} ~ ${project.end_date}`
      : '기간 미설정';
  const majorProjectName = project.major_project?.name ?? '대프로젝트 미분류';

  return (
    <section className="overflow-hidden rounded-[24px] border border-border bg-white shadow-[0_14px_40px_rgba(28,25,23,0.06)]">
      <header className="border-b border-border-subtle px-5 py-4">
        <div className="flex flex-wrap items-start gap-3">
          <button
            type="button"
            onClick={() => onToggle(project.id)}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-border-strong bg-surface-muted text-sm font-semibold text-text-muted transition hover:border-brand hover:text-brand"
            aria-label={isOpen ? '프로젝트 접기' : '프로젝트 펼치기'}
          >
            {isOpen ? '-' : '+'}
          </button>

          <div className="min-w-[220px] flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${colorForId(project.id)}`} />
              <h3 className="text-[17px] font-semibold tracking-[-0.02em] text-text">
                {project.name}
              </h3>
              <span className="rounded-full border border-brand-soft bg-brand-soft px-2.5 py-1 text-tiny font-bold text-brand">
                {majorProjectName}
              </span>
              <span className="rounded-full border border-brand-soft bg-white px-2.5 py-1 text-tiny font-bold text-brand">
                {typeLabel}
              </span>
              <span
                className={`rounded-full px-2.5 py-1 text-tiny font-bold ${
                  isCompleted
                    ? 'bg-verify-pass-bg text-verify-pass-fg'
                    : 'bg-verify-info-bg text-verify-info-fg'
                }`}
              >
                {isCompleted ? '프로젝트 완료' : '진행 중 프로젝트'}
              </span>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-micro text-text-muted">
              <span>생성일 {new Date(project.created_at).toLocaleDateString('ko-KR')}</span>
              <span>하위 프로젝트 {total}건</span>
              <span>완료 {done}건</span>
              <span>진행 중 {inProgress}건</span>
              <span>참여 인원 {project.participants.length}명</span>
              <span>{periodLabel}</span>
            </div>
          </div>

          <SummaryPanel>
            <div className="flex items-center justify-between text-micro font-semibold text-text-muted">
              <span>완료 항목</span>
              <span className={isCompleted ? 'text-verify-pass-fg' : 'text-verify-info-fg'}>
                {done}/{total}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between text-small font-bold text-text">
              <span>{isCompleted ? '프로젝트 완료' : '진행 중 프로젝트'}</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <ProgressBar
              value={progress}
              className="mt-2"
              ariaLabel={`${project.name} 진행률`}
            />
          </SummaryPanel>

          <SummaryPanel>
            <div className="flex items-center justify-between text-micro font-semibold text-text-muted">
              <span>투입 시간</span>
              <span className="text-text">
                {formatDuration(timeSummary.total_seconds)}
              </span>
            </div>
            <div className="mt-2 space-y-1.5">
              {topMembers.length === 0 ? (
                <p className="text-micro text-text-subtle">
                  아직 기록된 작업 시간이 없습니다.
                </p>
              ) : (
                topMembers.map((member) => (
                  <div
                    key={member.user_id}
                    className="flex items-center justify-between gap-3 text-micro text-text-muted"
                  >
                    <span className="truncate">{member.user_name}</span>
                    <span className="shrink-0 font-semibold text-text">
                      {formatDuration(member.total_seconds)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </SummaryPanel>

          <SummaryPanel>
            <div className="flex items-center justify-between text-micro font-semibold text-text-muted">
              <span>수행 이력</span>
              <span className="text-text">
                {historySummary.total_completed_count}건
              </span>
            </div>
            <div className="mt-2 space-y-1.5">
              {topHistoryMembers.length === 0 ? (
                <p className="text-micro text-text-subtle">
                  아직 완료 이력이 없습니다.
                </p>
              ) : (
                topHistoryMembers.map((member) => (
                  <div
                    key={member.user_id}
                    className="flex items-center justify-between gap-3 text-micro text-text-muted"
                  >
                    <div className="min-w-0">
                      <p className="truncate">{member.user_name}</p>
                      <p className="text-tiny text-text-subtle">
                        완료 {member.completed_count}건
                      </p>
                    </div>
                    <span className="shrink-0 font-semibold text-text">
                      {formatMinutes(member.total_minutes)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </SummaryPanel>

          {isAdmin && (
            <div className="flex flex-wrap gap-2">
              <ActionButton onClick={() => onEditProject(project)}>
                프로젝트 수정
              </ActionButton>
              <ActionButton tone="danger" onClick={() => onDeleteProject(project)}>
                프로젝트 삭제
              </ActionButton>
              <ActionButton onClick={() => onCsvImport(project.id)}>
                CSV 업무 가져오기
              </ActionButton>
              <button
                type="button"
                onClick={() => onAddSub(project.id)}
                className="rounded-[14px] bg-brand px-4 py-2 text-micro font-bold text-white shadow-[0_8px_20px_rgba(0,72,255,0.24)] transition hover:bg-brand-hover"
              >
                + 하위 프로젝트 추가
              </button>
            </div>
          )}
        </div>
      </header>

      {isOpen && (
        <div className="bg-surface-muted px-5 py-5">
          {subprojects.length === 0 ? (
            <p className="rounded-[18px] border border-dashed border-border-strong bg-white px-5 py-8 text-center text-sm text-text-subtle">
              아직 등록된 하위 프로젝트가 없습니다.
              {isAdmin ? ' 오른쪽 버튼에서 바로 추가할 수 있습니다.' : ''}
            </p>
          ) : (
            <ul className="space-y-3">
              {subprojects.map((sp) => (
                <SubProjectListItem
                  key={sp.id}
                  sp={sp}
                  onClick={onOpenSubProgress}
                  canEdit={isAdmin}
                  onEdit={onEditSub}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

function SummaryPanel({ children }: { children: ReactNode }) {
  return (
    <div className="min-w-[220px] flex-1 rounded-[18px] border border-border-subtle bg-surface-muted px-4 py-3">
      {children}
    </div>
  );
}

function ActionButton({
  children,
  onClick,
  tone = 'default',
}: {
  children: ReactNode;
  onClick: () => void;
  tone?: 'default' | 'danger';
}) {
  const className =
    tone === 'danger'
      ? 'rounded-[14px] border border-verify-fail-bg bg-white px-4 py-2 text-micro font-bold text-verify-fail-fg transition hover:bg-verify-fail-bg'
      : 'rounded-[14px] border border-brand-soft bg-white px-4 py-2 text-micro font-bold text-brand transition hover:bg-brand-soft';

  return (
    <button type="button" onClick={onClick} className={className}>
      {children}
    </button>
  );
}

function formatDuration(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours === 0) return `${minutes}분`;
  if (minutes === 0) return `${hours}시간`;
  return `${hours}시간 ${minutes}분`;
}

function formatMinutes(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}분`;
  if (minutes === 0) return `${hours}시간`;
  return `${hours}시간 ${minutes}분`;
}
