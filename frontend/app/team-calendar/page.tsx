'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import AppShell from '../components/AppShell';
import MonthCalendar, { shiftMonth } from '../components/MonthCalendar';
import TeamModal from '../components/TeamModal';
import ProgressBar from '../components/ProgressBar';
import TeamMemberFilter from '../components/TeamMemberFilter';
import {
  colorForId,
  softColorForId,
  textColorForId,
} from '../components/AppShell/colors';
import { apiFetch, type Project, type SubProject, type UserBrief } from '../lib/api';
import { useMe } from '../lib/useMe';
import { useWorkflowSelection } from '../lib/workflow-selection';

type MemberProjectGroup = {
  project: Project;
  subprojects: SubProject[];
  progress: number;
  completedCount: number;
  inProgressCount: number;
  plannedCount: number;
  startDate: string;
  endDate: string;
};

type MemberViewStyle = {
  label: string;
  summary: string;
};

export default function TeamCalendarPage() {
  const { me, loading: meLoading } = useMe();
  const { selectedMemberId, setSelectedMemberId, toggleSelectedMemberId } =
    useWorkflowSelection();
  const [cursor, setCursor] = useState(() => new Date());
  const [subprojects, setSubProjects] = useState<SubProject[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<UserBrief[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [modalDate, setModalDate] = useState<string | undefined>(undefined);
  const [modalInitial, setModalInitial] = useState<SubProject | null>(null);

  const load = useCallback(async () => {
    if (!me) return;
    setLoading(true);
    try {
      const [sps, ps, us] = await Promise.all([
        apiFetch<SubProject[]>('/subprojects'),
        apiFetch<Project[]>('/projects'),
        apiFetch<UserBrief[]>('/users'),
      ]);
      setSubProjects(sps);
      setProjects(ps);
      setUsers(us);
      setError('');
    } catch (nextError) {
      setError((nextError as Error).message);
    } finally {
      setLoading(false);
    }
  }, [me]);

  useEffect(() => {
    void load();
  }, [load]);

  const isAdmin = me?.role === 'admin';

  const orderedList = useMemo(
    () => [...subprojects].sort((left, right) => left.start_date.localeCompare(right.start_date)),
    [subprojects],
  );

  const selectedMember = useMemo(
    () => users.find((user) => user.id === selectedMemberId) ?? null,
    [users, selectedMemberId],
  );

  const selectedMemberTasks = useMemo(
    () =>
      selectedMemberId
        ? orderedList.filter((subproject) => subproject.assignee_id === selectedMemberId)
        : [],
    [orderedList, selectedMemberId],
  );

  const selectedMemberGroups = useMemo(() => {
    const projectMap = new Map<number, Project>(projects.map((project) => [project.id, project]));
    const grouped = new Map<number, SubProject[]>();

    for (const subproject of selectedMemberTasks) {
      const current = grouped.get(subproject.project_id);
      if (current) current.push(subproject);
      else grouped.set(subproject.project_id, [subproject]);
    }

    return Array.from(grouped.entries())
      .map(([projectId, items]) => {
        const project = projectMap.get(projectId);
        if (!project) return null;

        const startDate = items.reduce(
          (earliest, item) => (item.start_date < earliest ? item.start_date : earliest),
          items[0].start_date,
        );
        const endDate = items.reduce(
          (latest, item) => (item.end_date > latest ? item.end_date : latest),
          items[0].end_date,
        );
        const progress =
          items.reduce((sum, item) => sum + item.progress, 0) / Math.max(items.length, 1);

        return {
          project,
          subprojects: [...items].sort((left, right) => left.start_date.localeCompare(right.start_date)),
          progress,
          completedCount: items.filter((item) => item.status === 'completed').length,
          inProgressCount: items.filter((item) => item.status === 'in_progress').length,
          plannedCount: items.filter((item) => item.status === 'planned').length,
          startDate,
          endDate,
        } satisfies MemberProjectGroup;
      })
      .filter((group): group is MemberProjectGroup => group !== null)
      .sort((left, right) => {
        if (right.inProgressCount !== left.inProgressCount) {
          return right.inProgressCount - left.inProgressCount;
        }
        if (right.progress !== left.progress) {
          return right.progress - left.progress;
        }
        return left.startDate.localeCompare(right.startDate);
      });
  }, [projects, selectedMemberTasks]);

  const activeProjects = useMemo(
    () => projects.filter((project) => orderedList.some((subproject) => subproject.project_id === project.id)),
    [orderedList, projects],
  );

  const memberViewStyle = useMemo(() => {
    return deriveMemberViewStyle(selectedMemberGroups);
  }, [selectedMemberGroups]);

  const memberSummary = useMemo(() => {
    const projectCount = selectedMemberGroups.length;
    const subprojectCount = selectedMemberTasks.length;
    const averageProgress =
      selectedMemberTasks.length === 0
        ? 0
        : selectedMemberTasks.reduce((sum, item) => sum + item.progress, 0) / selectedMemberTasks.length;
    const nearestDeadline = [...selectedMemberTasks].sort((left, right) =>
      left.end_date.localeCompare(right.end_date),
    )[0];

    return {
      projectCount,
      subprojectCount,
      averageProgress,
      nearestDeadline: nearestDeadline?.end_date ?? null,
    };
  }, [selectedMemberGroups.length, selectedMemberTasks]);

  function openCreate(iso?: string) {
    if (!isAdmin) return;
    setModalMode('create');
    setModalDate(iso);
    setModalInitial(null);
    setModalOpen(true);
  }

  function openEdit(subproject: SubProject) {
    setModalMode('edit');
    setModalInitial(subproject);
    setModalOpen(true);
  }

  if (meLoading || !me) {
    return <main className="p-8 text-slate-900">불러오는 중...</main>;
  }

  return (
    <AppShell
      me={me}
      selectedMemberId={selectedMemberId}
      onMemberSelect={toggleSelectedMemberId}
      sidebarUsers={users}
      sidebarProjects={projects}
    >
      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="mb-6">
        <h1 className="text-[20px] font-bold tracking-[-0.3px] text-[#1A1A1A]">
          팀 캘린더
        </h1>
        <p className="mt-1 text-[12px] text-[#888780]">
          전체 일정과 담당자별 프로젝트 진행 현황을 한 화면에서 확인할 수 있습니다.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <MonthCalendar
          year={cursor.getFullYear()}
          month={cursor.getMonth()}
          subprojects={subprojects}
          onPrevMonth={() => setCursor((current) => shiftMonth(current, -1))}
          onNextMonth={() => setCursor((current) => shiftMonth(current, 1))}
          onSelectDate={(iso) => openCreate(iso)}
          onSelectSubProject={openEdit}
          title="전체 프로젝트 캘린더"
          tag="캘린더 A"
          tagColor="#534AB7"
          rightAction={
            isAdmin ? (
              <button
                type="button"
                onClick={() => openCreate()}
                className="rounded-lg border border-[#AFA9EC] bg-[#EEEDFE] px-3 py-1.5 text-[11px] font-bold text-[#534AB7]"
              >
                + 일정 추가
              </button>
            ) : undefined
          }
        />

        <div className="space-y-4">
          <MonthCalendar
            year={cursor.getFullYear()}
            month={cursor.getMonth()}
            subprojects={selectedMemberTasks}
            onPrevMonth={() => setCursor((current) => shiftMonth(current, -1))}
            onNextMonth={() => setCursor((current) => shiftMonth(current, 1))}
            onSelectSubProject={openEdit}
            title="담당자별 캘린더"
            tag="캘린더 B"
            tagColor="#0F6E56"
            filterSlot={
              <div className="flex flex-col items-start gap-1.5">
                <span className="text-[10px] text-[#888780]">담당자</span>
                <TeamMemberFilter
                  users={users}
                  selectedId={selectedMemberId ?? null}
                  onSelect={setSelectedMemberId}
                  myTeam={me.team}
                  singleSelection
                />
              </div>
            }
          />

          <SelectedMemberProjectBoard
            member={selectedMember}
            groups={selectedMemberGroups}
            summary={memberSummary}
            viewStyle={memberViewStyle}
            onOpenSubproject={openEdit}
          />
        </div>
      </div>

      <div className="my-6 h-px bg-[#EAEAE4]" />

      <section className="rounded-2xl border border-[#EAEAE4] bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-[15px] font-bold text-[#1A1A1A]">진행 중 프로젝트</h2>
            <p className="mt-1 text-[11px] text-[#888780]">
              일정 항목을 클릭하면 상세 모달로 이동합니다.
            </p>
          </div>
          <span className="text-[11px] text-[#888780]">{activeProjects.length}</span>
        </div>

        <div className="space-y-3">
          {loading && (
            <p className="rounded-xl bg-[#FAFAFA] px-4 py-6 text-center text-sm text-[#888780]">
              불러오는 중...
            </p>
          )}

          {!loading &&
            activeProjects.map((project) => {
              const related = orderedList.filter((subproject) => subproject.project_id === project.id);
              const doneCount = related.filter((subproject) => subproject.status === 'completed').length;
              const progress = related.length === 0 ? 0 : (doneCount / related.length) * 100;
              return (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => related[0] && openEdit(related[0])}
                  className="flex w-full items-center gap-[14px] rounded-xl border border-[#EAEAE4] bg-white px-4 py-[13px] text-left transition hover:border-[#D3D1C7] hover:bg-[#FAFAFA]"
                >
                  <span className={`h-[9px] w-[9px] rounded-full ${colorForId(project.id)}`} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-[#1A1A1A]">
                      {project.name}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-[#888780]">
                      {related[0]?.name ?? '소프로젝트 준비 중'}
                    </p>
                  </div>
                  <div className="hidden w-[90px] shrink-0 md:block">
                    <ProgressBar value={progress} className="h-1" />
                    <div className="mt-[3px] text-right text-[10px] text-[#888780]">
                      {Math.round(progress)}%
                    </div>
                  </div>
                  <span className="rounded-full bg-[#E6F1FB] px-2 py-1 text-[10px] font-bold text-[#185FA5]">
                    진행 중
                  </span>
                </button>
              );
            })}
        </div>
      </section>

      <TeamModal
        open={modalOpen}
        mode={modalMode}
        isAdmin={!!isAdmin}
        users={users}
        projects={projects}
        defaultDate={modalDate}
        initial={modalInitial}
        onClose={() => setModalOpen(false)}
        onSaved={load}
      />
    </AppShell>
  );
}

function SelectedMemberProjectBoard({
  member,
  groups,
  summary,
  viewStyle,
  onOpenSubproject,
}: {
  member: UserBrief | null;
  groups: MemberProjectGroup[];
  summary: {
    projectCount: number;
    subprojectCount: number;
    averageProgress: number;
    nearestDeadline: string | null;
  };
  viewStyle: { label: string; summary: string };
  onOpenSubproject: (subproject: SubProject) => void;
}) {
  if (!member) {
    return (
      <section className="rounded-2xl border border-dashed border-[#D8D4C8] bg-[#FCFBF8] p-5">
        <h2 className="text-[15px] font-bold text-[#1A1A1A]">담당자 프로젝트 보기</h2>
        <p className="mt-2 text-[12px] leading-6 text-[#6F6D66]">
          드롭다운에서 담당자를 선택하면 해당 담당자의 프로젝트 흐름과 진행 이력을 볼 수 있습니다.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-[#EAEAE4] bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 border-b border-[#F1EFE8] pb-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold ${softColorForId(member.id)} ${textColorForId(member.id)}`}
            >
              {member.name}
            </span>
            {member.position && (
              <span className="rounded-full border border-[#EAEAE4] px-2.5 py-1 text-[10px] font-semibold text-[#66645C]">
                {member.position}
              </span>
            )}
            <span className="rounded-full border border-[#EAEAE4] px-2.5 py-1 text-[10px] font-semibold text-[#66645C]">
              {viewStyle.label}
            </span>
          </div>
          <h2 className="mt-3 text-[15px] font-bold text-[#1A1A1A]">
            {member.name} 담당 프로젝트 보기
          </h2>
          <p className="mt-1 text-[11px] leading-5 text-[#888780]">{viewStyle.summary}</p>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <MetricCard label="프로젝트" value={String(summary.projectCount)} />
          <MetricCard label="일정 수" value={String(summary.subprojectCount)} />
          <MetricCard label="평균 진행률" value={`${Math.round(summary.averageProgress)}%`} />
          <MetricCard label="다음 마감" value={summary.nearestDeadline ?? '-'} />
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {groups.length === 0 && (
          <div className="rounded-2xl border border-dashed border-[#D8D4C8] bg-[#FCFBF8] px-4 py-6 text-center">
            <p className="text-[13px] font-semibold text-[#1A1A1A]">
              아직 배정된 프로젝트 이력이 없습니다
            </p>
            <p className="mt-1 text-[11px] text-[#888780]">
              이 담당자에게 일정이 배정되면 여기에서 프로젝트별 진행 카드를 확인할 수 있습니다.
            </p>
          </div>
        )}

        {groups.map((group) => (
          <article
            key={`${member.id}-${group.project.id}`}
            className="rounded-2xl border border-[#EAEAE4] bg-[#FFFEFC] p-4"
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${colorForId(group.project.id)}`} />
                  <h3 className="truncate text-[14px] font-bold text-[#1A1A1A]">
                    {group.project.name}
                  </h3>
                  <StatusChip
                    completedCount={group.completedCount}
                    inProgressCount={group.inProgressCount}
                    plannedCount={group.plannedCount}
                  />
                </div>
                <p className="mt-1 text-[11px] text-[#888780]">
                  {group.startDate} ~ {group.endDate} | 추적 중인 일정 {group.subprojects.length}건
                </p>
              </div>

              <div className="w-full max-w-[240px]">
                <div className="mb-1 flex items-center justify-between text-[11px] text-[#66645C]">
                  <span>프로젝트 진행률</span>
                  <span>{Math.round(group.progress)}%</span>
                </div>
                <ProgressBar value={group.progress} className="h-1.5" />
              </div>
            </div>

            <div className="mt-4 space-y-2">
              {group.subprojects.map((subproject) => (
                <button
                  key={subproject.id}
                  type="button"
                  onClick={() => onOpenSubproject(subproject)}
                  className="flex w-full items-start justify-between gap-3 rounded-xl border border-[#F1EFE8] bg-white px-3 py-3 text-left transition hover:border-[#D6D2C5] hover:bg-[#FAFAF7]"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${softColorForId(member.id)} ${textColorForId(member.id)}`}
                      >
                        {statusLabel(subproject.status)}
                      </span>
                      <span className="truncate text-[13px] font-semibold text-[#1A1A1A]">
                        {subproject.name}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-[#888780]">
                      {subproject.start_date} to {subproject.end_date}
                    </p>
                    <p className="mt-1 text-[11px] leading-5 text-[#66645C]">
                      {buildSubprojectNarrative(member, subproject)}
                    </p>
                  </div>

                  <div className="w-[78px] shrink-0">
                    <div className="text-right text-[11px] font-semibold text-[#1A1A1A]">
                      {Math.round(subproject.progress)}%
                    </div>
                    <ProgressBar value={subproject.progress} className="mt-2 h-1.5" />
                  </div>
                </button>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#EAEAE4] bg-[#FAFAF7] px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-[0.04em] text-[#888780]">
        {label}
      </div>
      <div className="mt-1 text-[13px] font-bold text-[#1A1A1A]">{value}</div>
    </div>
  );
}

function StatusChip({
  completedCount,
  inProgressCount,
  plannedCount,
}: {
  completedCount: number;
  inProgressCount: number;
  plannedCount: number;
}) {
  let label = '예정';
  let classes = 'bg-[#FAEEDA] text-[#854F0B]';

  if (inProgressCount > 0) {
    label = '진행 중';
    classes = 'bg-[#E6F1FB] text-[#185FA5]';
  } else if (completedCount > 0 && plannedCount === 0) {
    label = '완료';
    classes = 'bg-[#E1F5EE] text-[#0F6E56]';
  }

  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${classes}`}>
      {label}
    </span>
  );
}

function statusLabel(status: SubProject['status']) {
  if (status === 'completed') return '완료';
  if (status === 'in_progress') return '진행 중';
  return '예정';
}

function deriveMemberViewStyle(groups: MemberProjectGroup[]): MemberViewStyle {
  const totalInProgress = groups.reduce((sum, group) => sum + group.inProgressCount, 0);
  const totalPlanned = groups.reduce((sum, group) => sum + group.plannedCount, 0);
  const totalCompleted = groups.reduce((sum, group) => sum + group.completedCount, 0);
  const nearestDeadline = groups
    .flatMap((group) => group.subprojects.map((subproject) => subproject.end_date))
    .sort()[0];

  if (nearestDeadline) {
    const today = new Date();
    const deadline = new Date(nearestDeadline);
    const diffDays = Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays <= 7) {
      return {
        label: '마감 우선',
        summary: '일주일 이내 마감 일정이 있어 가까운 마감 기한이 먼저 보이도록 구성했습니다.',
      };
    }
  }

  if (totalInProgress >= 2) {
    return {
      label: '동시 진행',
      summary: '현재 동시에 진행 중인 일정이 여러 개라서 병행 작업 흐름이 눈에 띄도록 구성했습니다.',
    };
  }

  if (totalPlanned > totalCompleted) {
    return {
      label: '계획 중심',
      summary: '예정된 일정 비중이 더 높아 향후 시작 일정과 대기 중인 작업이 먼저 보이도록 구성했습니다.',
    };
  }

  return {
    label: '완료 추적',
    summary: '완료되었거나 마무리 단계인 일정이 많아 현재 납품 진행 상태를 중심으로 보여줍니다.',
  };
}

function buildSubprojectNarrative(member: UserBrief, subproject: SubProject) {
  const completedSubtasks = subproject.subtasks.filter((task) => task.is_done).length;
  const totalSubtasks = subproject.subtasks.length;
  const assigneeLabel = subproject.assignee?.name ?? member.name;
  const status = statusLabel(subproject.status);

  if (totalSubtasks === 0) {
    return `${assigneeLabel} 담당 일정은 ${subproject.start_date}부터 ${subproject.end_date}까지이며, 현재 상태는 ${status}입니다. 아직 등록된 세부 체크리스트는 없습니다.`;
  }

  return `${assigneeLabel} 담당 일정은 ${subproject.start_date}부터 ${subproject.end_date}까지이며, 현재 상태는 ${status}입니다. 체크리스트 ${totalSubtasks}개 중 ${completedSubtasks}개가 완료되었습니다.`;
}
