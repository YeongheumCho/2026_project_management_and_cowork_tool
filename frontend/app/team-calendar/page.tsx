'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import AppShell from '../components/AppShell';
import MonthCalendar, { shiftMonth } from '../components/MonthCalendar';
import TeamModal from '../components/TeamModal';
import ProgressBar from '../components/ProgressBar';
import TeamMemberFilter from '../components/TeamMemberFilter';
import CreateProjectModal from '../projects/components/CreateProjectModal';
import {
  colorForId,
  softColorForId,
  softColorForPosition,
  textColorForId,
  textColorForPosition,
} from '../components/AppShell/colors';
import { apiFetch, type Project, type SubProject, type UserBrief } from '../lib/api';
import { compactPosition } from '../lib/display';
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
};

export default function TeamCalendarPage() {
  const { me, loading: meLoading } = useMe();
  const { selectedMemberId, setSelectedMemberId, toggleSelectedMemberId } =
    useWorkflowSelection();
  const [cursor, setCursor] = useState(() => new Date());
  const [subprojects, setSubProjects] = useState<SubProject[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<UserBrief[]>([]);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [modalInitial, setModalInitial] = useState<SubProject | null>(null);
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [projectModalDate, setProjectModalDate] = useState<string | undefined>(undefined);

  const load = useCallback(async () => {
    if (!me) return;
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

  const projectCalendarItems = useMemo<SubProject[]>(
    () =>
      projects
        .filter((project) => project.start_date && project.end_date)
        .map((project) => ({
          id: project.id,
          project_id: project.id,
          name: project.name,
          assignee_id: null,
          assignee: null,
          assignee_ids: [],
          assignees: [],
          start_date: project.start_date!,
          end_date: project.end_date!,
          status:
            project.progress_percent >= 100
              ? 'completed'
              : project.progress_percent > 0
                ? 'in_progress'
                : 'planned',
          progress: project.progress_percent ?? 0,
          subtasks: [],
          created_at: project.created_at,
          updated_at: project.created_at,
        })),
    [projects],
  );

  const selectedMember = useMemo(
    () => users.find((user) => user.id === selectedMemberId) ?? null,
    [users, selectedMemberId],
  );

  const selectedMemberTasks = useMemo(
    () =>
      selectedMemberId
        ? orderedList.filter((subproject) =>
            subproject.assignee_ids.includes(selectedMemberId),
          )
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

  function openEdit(subproject: SubProject) {
    setModalMode('edit');
    setModalInitial(subproject);
    setModalOpen(true);
  }

  function openCreateProject(iso?: string) {
    if (!isAdmin) return;
    setProjectModalDate(iso);
    setProjectModalOpen(true);
  }

  if (meLoading || !me) {
    return <main className="p-8 text-text">불러오는 중...</main>;
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
        <h1 className="text-xl font-bold tracking-[-0.3px] text-[#1A1A1A]">
          팀 캘린더
        </h1>
        <p className="mt-1 text-small text-[#888780]">
          전체 일정과 담당자별 프로젝트 진행 현황을 한 화면에서 확인할 수 있습니다.
        </p>
      </div>

      {/* ?댁뒋5: ?꾩껜 罹섎┛?붾? ?곷떒 ?꾩껜?? ?섎떒 2??援ъ꽦?쇰줈 蹂寃???鍮??щ갚 ?댁냼 */}
      <div className="space-y-4">
        {/* 罹섎┛??A ???꾩껜 ?꾨줈?앺듃 (?곗냽 諛? ?댁뒋7) */}
        <MonthCalendar
          year={cursor.getFullYear()}
          month={cursor.getMonth()}
          subprojects={projectCalendarItems}
          onPrevMonth={() => setCursor((current) => shiftMonth(current, -1))}
          onNextMonth={() => setCursor((current) => shiftMonth(current, 1))}
          onSelectDate={(iso) => openCreateProject(iso)}
          title="전체 프로젝트 캘린더"
          tag="캘린더 A"
          tagColor="#534AB7"
          continuousBars
          rightAction={
            isAdmin ? (
              <button
                type="button"
                onClick={() => openCreateProject()}
                className="rounded-lg border border-[#AFA9EC] bg-[#EEEDFE] px-3 py-1.5 text-micro font-bold text-[#534AB7]"
              >
                + 프로젝트 추가
              </button>
            ) : undefined
          }
        />

        {/* ?섎떒 2?? 罹섎┛??B + ?대떦??蹂대뱶 */}
        <div className="grid gap-4 xl:grid-cols-2">
          <div className="space-y-4">
            {/* 罹섎┛??B ???대떦?먮퀎 */}
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
              continuousBars
              filterSlot={
                <div className="flex flex-col items-start gap-1.5">
                  {/* ?댁뒋6: ?대떦???덉씠釉?蹂쇰뱶 */}
                  <span className="text-tiny font-bold text-[#1A1A1A]">담당자</span>
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

            {/* ?댁뒋6-1: 李⑥썡 罹섎┛??*/}
            <MonthCalendar
              year={shiftMonth(cursor, 1).getFullYear()}
              month={shiftMonth(cursor, 1).getMonth()}
              subprojects={selectedMemberTasks}
              onPrevMonth={() => setCursor((current) => shiftMonth(current, -1))}
              onNextMonth={() => setCursor((current) => shiftMonth(current, 1))}
              onSelectSubProject={openEdit}
              title="담당자별 캘린더 (차월)"
              tag="캘린더 B+1"
              tagColor="#0F6E56"
              continuousBars
            />

          </div>

          <SelectedMemberProjectBoard
            member={selectedMember}
            groups={selectedMemberGroups}
            summary={memberSummary}
            viewStyle={memberViewStyle}
            onOpenSubproject={openEdit}
          />
        </div>
      </div>

      <TeamModal
        open={modalOpen}
        mode={modalMode}
        isAdmin={!!isAdmin}
        users={users}
        projects={projects}
        initial={modalInitial}
        onClose={() => setModalOpen(false)}
        onSaved={load}
      />

      <CreateProjectModal
        open={projectModalOpen}
        users={users}
        defaultDate={projectModalDate}
        onClose={() => {
          setProjectModalOpen(false);
          setProjectModalDate(undefined);
        }}
        onCreated={async () => {
          await load();
          setProjectModalDate(undefined);
        }}
        onError={setError}
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
  viewStyle: { label: string };
  onOpenSubproject: (subproject: SubProject) => void;
}) {
  if (!member) {
    return (
      <section className="rounded-2xl border border-dashed border-[#D8D4C8] bg-[#FCFBF8] p-5">
        <h2 className="text-heading font-bold text-[#1A1A1A]">담당자 프로젝트 보기</h2>
        <p className="mt-2 text-small leading-6 text-[#6F6D66]">
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
              className={`inline-flex max-w-full items-center truncate whitespace-nowrap rounded-full px-2.5 py-1 text-tiny font-bold ${softColorForPosition(member.position)} ${textColorForPosition(member.position)}`}
            >
              {member.name}
            </span>
            {member.position && (
              <span className="whitespace-nowrap rounded-full border border-[#EAEAE4] px-2.5 py-1 text-tiny font-semibold text-[#66645C]">
                {compactPosition(member.position)}
              </span>
            )}
            <span className="rounded-full border border-[#EAEAE4] px-2.5 py-1 text-tiny font-semibold text-[#66645C]">
              {viewStyle.label}
            </span>
          </div>
          <h2 className="mt-3 text-heading font-bold text-[#1A1A1A]">
            {member.name} 담당 프로젝트 보기
          </h2>
        </div>

        {/* ?댁뒋1: 移대뱶 ?믪씠 ?듭씪 ??items-stretch濡?以?留욎땄 */}
        <div className="grid grid-cols-2 items-stretch gap-2 sm:grid-cols-4 lg:min-w-[430px]">
          <MetricCard label="프로젝트" value={String(summary.projectCount)} />
          <MetricCard label="일정 수" value={String(summary.subprojectCount)} />
          <MetricCard label="평균 진행률" value={`${Math.round(summary.averageProgress)}%`} />
          <MetricCard label="다음 마감" value={summary.nearestDeadline ?? '-'} />
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {groups.length === 0 && (
          <div className="rounded-2xl border border-dashed border-[#D8D4C8] bg-[#FCFBF8] px-4 py-6 text-center">
            <p className="text-body font-semibold text-[#1A1A1A]">
              아직 배정된 프로젝트 이력이 없습니다
            </p>
            <p className="mt-1 text-micro text-[#888780]">
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
                  <h3 className="min-w-0 truncate text-md font-bold text-[#1A1A1A]">
                    {group.project.name}
                  </h3>
                  <StatusChip
                    completedCount={group.completedCount}
                    inProgressCount={group.inProgressCount}
                    plannedCount={group.plannedCount}
                  />
                </div>
                <p className="mt-1 truncate text-micro text-[#888780]">
                  {group.startDate} ~ {group.endDate} | 진행 중인 일정 {group.subprojects.length}건
                </p>
              </div>

              <div className="w-full max-w-[240px]">
                <div className="mb-1 flex items-center justify-between text-micro text-[#66645C]">
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
                  className="flex w-full items-center justify-between gap-3 rounded-xl border border-[#F1EFE8] bg-white px-3 py-3 text-left transition hover:border-[#D6D2C5] hover:bg-[#FAFAF7]"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-tiny font-bold ${softColorForId(group.project.id)} ${textColorForId(group.project.id)}`}
                      >
                        {statusLabel(subproject.status)}
                      </span>
                      <span className="truncate text-body font-semibold text-[#1A1A1A]">
                        {subproject.name}
                      </span>
                    </div>
                    <p className="mt-1 text-micro text-[#888780]">
                      {subproject.start_date} to {subproject.end_date}
                    </p>
                    <p className="mt-1 truncate text-micro text-[#66645C]">
                      {buildSubprojectNarrative(member, subproject)}
                    </p>
                  </div>

                  <div className="w-[78px] shrink-0">
                    <div className="text-right text-micro font-semibold text-[#1A1A1A]">
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
    /* ?댁뒋1: flex-col justify-between?쇰줈 ?덉씠釉?媛믪씠 ??긽 媛숈? ?꾩튂??怨좎젙 */
    <div className="flex min-w-0 flex-col justify-between rounded-xl border border-[#EAEAE4] bg-[#FAFAF7] px-3 py-2">
      <div className="whitespace-nowrap text-tiny font-semibold uppercase tracking-[0.04em] text-[#888780]">
        {label}
      </div>
      <div className="mt-1 whitespace-nowrap text-body font-bold text-[#1A1A1A]">{value}</div>
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
    <span className={`rounded-full px-2 py-0.5 text-tiny font-bold ${classes}`}>
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
      };
    }
  }

  if (totalInProgress >= 2) {
    return {
      label: '동시 진행',
    };
  }

  if (totalPlanned > totalCompleted) {
    return {
      label: '계획 중심',
    };
  }

  return {
    label: '완료 추적',
  };
}

function buildSubprojectNarrative(member: UserBrief, subproject: SubProject) {
  const completedSubtasks = subproject.subtasks.filter((task) => task.is_done).length;
  const totalSubtasks = subproject.subtasks.length;
  const assigneeLabel =
    subproject.assignees?.find((assignee) => assignee.id === member.id)?.name ??
    member.name;
  const status = statusLabel(subproject.status);

  if (totalSubtasks === 0) {
    return `${assigneeLabel} 담당 일정은 ${subproject.start_date}부터 ${subproject.end_date}까지이며, 현재 상태는 ${status}입니다. 아직 등록된 세부 체크리스트는 없습니다.`;
  }

  return `${assigneeLabel} 담당 일정은 ${subproject.start_date}부터 ${subproject.end_date}까지이며, 현재 상태는 ${status}입니다. 체크리스트 ${totalSubtasks}개 중 ${completedSubtasks}개가 완료되었습니다.`;
}
