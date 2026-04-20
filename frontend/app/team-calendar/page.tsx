'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import AppShell from '../components/AppShell';
import MonthCalendar, { shiftMonth } from '../components/MonthCalendar';
import TeamModal from '../components/TeamModal';
import { apiFetch, type Project, type SubProject, type UserBrief } from '../lib/api';
import { useMe } from '../lib/useMe';

const STATUS_LABEL: Record<SubProject['status'], string> = {
  planned: '예정',
  in_progress: '진행중',
  completed: '완료',
};

const STATUS_DOT: Record<SubProject['status'], string> = {
  planned: 'bg-slate-400',
  in_progress: 'bg-blue-500',
  completed: 'bg-emerald-500',
};

export default function TeamCalendarPage() {
  const { me, loading: meLoading } = useMe();
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
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [me]);

  useEffect(() => {
    void load();
  }, [load]);

  const isAdmin = me?.role === 'admin';

  const openCreate = (iso?: string) => {
    if (!isAdmin) return; // 일반 직원은 접근 불가
    setModalMode('create');
    setModalDate(iso);
    setModalInitial(null);
    setModalOpen(true);
  };

  const openEdit = (sp: SubProject) => {
    setModalMode('edit');
    setModalInitial(sp);
    setModalOpen(true);
  };

  const orderedList = useMemo(
    () => [...subprojects].sort((a, b) => a.start_date.localeCompare(b.start_date)),
    [subprojects],
  );

  if (meLoading || !me) {
    return <main className="p-8 text-slate-900">불러오는 중...</main>;
  }

  return (
    <AppShell me={me}>
      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <MonthCalendar
          year={cursor.getFullYear()}
          month={cursor.getMonth()}
          subprojects={subprojects}
          onPrevMonth={() => setCursor((c) => shiftMonth(c, -1))}
          onNextMonth={() => setCursor((c) => shiftMonth(c, +1))}
          onSelectDate={(iso) => openCreate(iso)}
          onSelectSubProject={(sp) => openEdit(sp)}
          rightAction={
            isAdmin ? (
              <button
                onClick={() => openCreate()}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
              >
                + 소프로젝트 추가
              </button>
            ) : null
          }
        />

        <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold">일반 리스트</h3>
            {isAdmin && (
              <button
                onClick={() => openCreate()}
                className="rounded-lg border border-blue-200 px-2.5 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50"
              >
                + 추가
              </button>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-400">
            전체 소프로젝트가 시작일 순으로 표시됩니다.
          </p>

          <div className="mt-3 max-h-[560px] space-y-2 overflow-y-auto">
            {loading && (
              <p className="py-4 text-center text-sm text-slate-400">불러오는 중...</p>
            )}
            {!loading && orderedList.length === 0 && (
              <p className="py-4 text-center text-sm text-slate-400">
                아직 등록된 소프로젝트가 없습니다.
              </p>
            )}
            {orderedList.map((sp) => (
              <button
                key={sp.id}
                onClick={() => openEdit(sp)}
                className="block w-full rounded-xl border border-slate-100 bg-slate-50 p-3 text-left hover:bg-slate-100"
              >
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${STATUS_DOT[sp.status]}`} />
                  <span className="text-sm font-medium">{sp.name}</span>
                  <span className="ml-auto text-[11px] text-slate-500">
                    {STATUS_LABEL[sp.status]}
                  </span>
                </div>
                <div className="mt-1 flex justify-between text-[11px] text-slate-500">
                  <span>{sp.assignee?.name ?? '담당자 미지정'}</span>
                  <span>
                    {sp.start_date} ~ {sp.end_date}
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full bg-blue-500"
                    style={{ width: `${sp.progress}%` }}
                  />
                </div>
              </button>
            ))}
          </div>
        </aside>
      </div>

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
