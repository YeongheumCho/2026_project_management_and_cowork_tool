'use client';

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
      : '기간 미지정';

  return (
    <section className="overflow-hidden rounded-[24px] border border-[#E7E5DD] bg-white shadow-[0_14px_40px_rgba(28,25,23,0.06)]">
      <header className="border-b border-[#F0EEE7] px-5 py-4">
        <div className="flex flex-wrap items-start gap-3">
          <button
            type="button"
            onClick={() => onToggle(project.id)}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#DDDAD0] bg-[#FAFAF7] text-sm font-semibold text-[#5F5E5A] transition hover:border-[#BDB8E9] hover:text-[#534AB7]"
            aria-label={isOpen ? '프로젝트 접기' : '프로젝트 펼치기'}
          >
            {isOpen ? '-' : '+'}
          </button>

          <div className="min-w-[220px] flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${colorForId(project.id)}`} />
              <h3 className="text-[17px] font-semibold tracking-[-0.02em] text-[#1D1D1B]">
                {project.name}
              </h3>
              <span className="rounded-full border border-[#E5E2FF] bg-[#F5F3FF] px-2.5 py-1 text-tiny font-bold uppercase tracking-[0.08em] text-[#534AB7]">
                {typeLabel}
              </span>
              <span
                className={`rounded-full px-2.5 py-1 text-tiny font-bold ${
                  isCompleted
                    ? 'bg-[#E1F5EE] text-[#0F6E56]'
                    : 'bg-[#E6F1FB] text-[#185FA5]'
                }`}
              >
                {isCompleted ? '완료' : '진행중'}
              </span>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-micro text-[#7A786F]">
              <span>생성일 {new Date(project.created_at).toLocaleDateString('ko-KR')}</span>
              <span>하위 프로젝트 {total}건</span>
              <span>완료 {done}건</span>
              <span>진행 중 {inProgress}건</span>
              <span>참여 인원 {project.participants.length}명</span>
              <span>{periodLabel}</span>
            </div>
          </div>

          <div className="min-w-[180px] flex-1 rounded-[18px] border border-[#F0EEE7] bg-[#FCFCFA] px-4 py-3">
            <div className="flex items-center justify-between text-micro font-semibold text-[#5F5E5A]">
              <span>완료 항목</span>
              <span className={isCompleted ? 'text-[#0F6E56]' : 'text-[#185FA5]'}>
                {done}/{total}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between text-small font-bold text-[#1D1D1B]">
              <span>{isCompleted ? '프로젝트 완료' : '진행 중 프로젝트'}</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <ProgressBar
              value={progress}
              className="mt-2"
              ariaLabel={`${project.name} 진행률`}
            />
          </div>

          <div className="min-w-[240px] flex-1 rounded-[18px] border border-[#F0EEE7] bg-[#FCFCFA] px-4 py-3">
            <div className="flex items-center justify-between text-micro font-semibold text-[#5F5E5A]">
              <span>투입 시간</span>
              <span className="text-[#1D1D1B]">
                {formatDuration(timeSummary.total_seconds)}
              </span>
            </div>
            <div className="mt-2 space-y-1.5">
              {topMembers.length === 0 ? (
                <p className="text-micro text-[#8B897F]">
                  아직 기록된 작업 시간이 없습니다.
                </p>
              ) : (
                topMembers.map((member) => (
                  <div
                    key={member.user_id}
                    className="flex items-center justify-between gap-3 text-micro text-[#5F5E5A]"
                  >
                    <span className="truncate">{member.user_name}</span>
                    <span className="shrink-0 font-semibold text-[#1D1D1B]">
                      {formatDuration(member.total_seconds)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="min-w-[240px] flex-1 rounded-[18px] border border-[#F0EEE7] bg-[#FCFCFA] px-4 py-3">
            <div className="flex items-center justify-between text-micro font-semibold text-[#5F5E5A]">
              <span>수행 이력</span>
              <span className="text-[#1D1D1B]">
                {historySummary.total_completed_count}건
              </span>
            </div>
            <div className="mt-2 space-y-1.5">
              {topHistoryMembers.length === 0 ? (
                <p className="text-micro text-[#8B897F]">
                  아직 누적된 완료 이력이 없습니다.
                </p>
              ) : (
                topHistoryMembers.map((member) => (
                  <div
                    key={member.user_id}
                    className="flex items-center justify-between gap-3 text-micro text-[#5F5E5A]"
                  >
                    <div className="min-w-0">
                      <p className="truncate">{member.user_name}</p>
                      <p className="text-tiny text-[#8B897F]">
                        완료 {member.completed_count}건
                      </p>
                    </div>
                    <span className="shrink-0 font-semibold text-[#1D1D1B]">
                      {formatMinutes(member.total_minutes)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {isAdmin && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onEditProject(project)}
                className="rounded-[14px] border border-[#D8D3FF] bg-white px-4 py-2 text-micro font-bold text-[#534AB7] transition hover:bg-[#F5F3FF]"
              >
                프로젝트 수정
              </button>
              <button
                type="button"
                onClick={() => onDeleteProject(project)}
                className="rounded-[14px] border border-[#F4C9C9] bg-white px-4 py-2 text-micro font-bold text-[#A32D2D] transition hover:bg-[#FFF4F4]"
              >
                프로젝트 삭제
              </button>
              <button
                type="button"
                onClick={() => onCsvImport(project.id)}
                className="rounded-[14px] border border-[#D8D3FF] bg-white px-4 py-2 text-micro font-bold text-[#534AB7] transition hover:bg-[#F5F3FF]"
              >
                CSV 일괄 등록
              </button>
              <button
                type="button"
                onClick={() => onAddSub(project.id)}
                className="rounded-[14px] bg-[#534AB7] px-4 py-2 text-micro font-bold text-white shadow-[0_8px_20px_rgba(83,74,183,0.24)] transition hover:bg-[#473EA7]"
              >
                + 하위 프로젝트 추가
              </button>
            </div>
          )}
        </div>
      </header>

      {isOpen && (
        <div className="bg-[#FBFBF8] px-5 py-5">
          {subprojects.length === 0 ? (
            <p className="rounded-[18px] border border-dashed border-[#D7D4CA] bg-white px-5 py-8 text-center text-sm text-[#8B897F]">
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
