'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import AppShell from '../components/AppShell';
import MonthCalendar, { shiftMonth } from '../components/MonthCalendar';
import TeamModal from '../components/TeamModal';
import ProgressBar from '../components/ProgressBar';
import { apiFetch, type Project, type SubProject, type UserBrief } from '../lib/api';
import { useMe } from '../lib/useMe';
import { useWorkflowSelection } from '../lib/workflow-selection';
import { colorForId, softColorForId, textColorForId } from '../components/AppShell/colors';

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
  const selectedMemberTasks = useMemo(
    () =>
      selectedMemberId
        ? orderedList.filter((subproject) => subproject.assignee_id === selectedMemberId)
        : [],
    [orderedList, selectedMemberId],
  );
  const activeProjects = useMemo(
    () => projects.filter((project) => orderedList.some((subproject) => subproject.project_id === project.id)),
    [orderedList, projects],
  );

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
          전체 프로젝트 일정과 담당자별 개인 일정을 한 화면에서 확인할 수 있습니다.
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
                + 소프로젝트 추가
              </button>
            ) : undefined
          }
        />

        <MonthCalendar
          year={cursor.getFullYear()}
          month={cursor.getMonth()}
          subprojects={selectedMemberTasks}
          onPrevMonth={() => setCursor((current) => shiftMonth(current, -1))}
          onNextMonth={() => setCursor((current) => shiftMonth(current, 1))}
          onSelectSubProject={openEdit}
          title="담당자별 개인 캘린더"
          tag="캘린더 B"
          tagColor="#0F6E56"
          filterSlot={
            <div className="flex flex-wrap items-center gap-[5px]">
              <span className="text-[10px] text-[#888780]">담당자</span>
              <button
                type="button"
                onClick={() => setSelectedMemberId(null)}
                className={`rounded-full border px-[9px] py-1 text-[11px] ${
                  selectedMemberId === null
                    ? 'border-[#534AB7] bg-[#EEEDFE] text-[#534AB7]'
                    : 'border-[#EAEAE4] text-[#888780]'
                }`}
              >
                전체
              </button>
              {users.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => setSelectedMemberId(user.id)}
                  className={`inline-flex items-center gap-1 rounded-full border px-[9px] py-1 text-[11px] ${
                    selectedMemberId === user.id
                      ? `${softColorForId(user.id)} ${textColorForId(user.id)} border-transparent`
                      : 'border-[#EAEAE4] text-[#888780]'
                  }`}
                >
                  <span className={`h-[6px] w-[6px] rounded-full ${colorForId(user.id)}`} />
                  {user.name}
                </button>
              ))}
            </div>
          }
        />
      </div>

      <div className="my-6 h-px bg-[#EAEAE4]" />

      <section className="rounded-2xl border border-[#EAEAE4] bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-[15px] font-bold text-[#1A1A1A]">진행 중 프로젝트</h2>
            <p className="mt-1 text-[11px] text-[#888780]">
              일정 막대를 클릭하면 상세 모달로 이어집니다.
            </p>
          </div>
          <span className="text-[11px] text-[#888780]">{activeProjects.length}건</span>
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
                    진행중
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
