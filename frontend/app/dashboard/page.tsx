'use client';

import { useEffect, useMemo, useState } from 'react';
import AppShell from '../components/AppShell';
import { apiFetch, type Project, type SubProject, type UserBrief } from '../lib/api';
import { toISODate } from '../lib/calendar';
import { useMe } from '../lib/useMe';

const STATUS_LABEL: Record<SubProject['status'], string> = {
  planned: '예정',
  in_progress: '진행중',
  completed: '완료',
};

const STATUS_BADGE: Record<SubProject['status'], string> = {
  planned: 'bg-slate-100 text-slate-600',
  in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-emerald-100 text-emerald-700',
};

export default function DashboardPage() {
  const { me, loading: meLoading } = useMe();

  const [projects, setProjects] = useState<Project[]>([]);
  const [subprojects, setSubProjects] = useState<SubProject[]>([]);
  const [users, setUsers] = useState<UserBrief[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!me) return;
    (async () => {
      try {
        const [ps, sps, us] = await Promise.all([
          apiFetch<Project[]>('/projects'),
          apiFetch<SubProject[]>('/subprojects'),
          apiFetch<UserBrief[]>('/users'),
        ]);
        setProjects(ps);
        setSubProjects(sps);
        setUsers(us);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [me]);

  const todayIso = toISODate(new Date());
  const inProgressCount = useMemo(
    () => subprojects.filter((sp) => sp.status !== 'completed').length,
    [subprojects],
  );
  const dueTodayCount = useMemo(
    () =>
      subprojects.filter(
        (sp) => sp.end_date === todayIso && sp.status !== 'completed',
      ).length,
    [subprojects, todayIso],
  );
  const memberCount = users.length;

  const myTodaySubprojects = useMemo(() => {
    if (!me) return [];
    return subprojects.filter(
      (sp) =>
        sp.assignee_id === me.id &&
        sp.start_date <= todayIso &&
        sp.end_date >= todayIso &&
        sp.status !== 'completed',
    );
  }, [subprojects, me, todayIso]);

  const recentSubprojects = useMemo(
    () =>
      [...subprojects]
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, 5),
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

      <p className="mb-6 text-sm text-slate-500">
        프로젝트와 업무 현황을 한눈에 확인하는 공간 ·{' '}
        {new Date().toLocaleDateString('ko-KR', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          weekday: 'long',
        })}
      </p>

      <div className="grid gap-4 md:grid-cols-3">
        <KpiCard
          label="진행 중 소프로젝트"
          value={inProgressCount}
          hint={`전체 ${subprojects.length}건 중`}
          loading={loading}
        />
        <KpiCard
          label="오늘 마감 업무"
          value={dueTodayCount}
          hint={dueTodayCount > 0 ? '확인이 필요합니다' : '오늘 마감 없음'}
          loading={loading}
          accent={dueTodayCount > 0 ? 'warn' : 'normal'}
        />
        <KpiCard
          label="활성 팀원 수"
          value={memberCount}
          hint={`관리자 ${users.filter((u) => u.role === 'admin').length}명 / 일반 ${users.filter((u) => u.role === 'member').length}명`}
          loading={loading}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-baseline justify-between">
            <h3 className="text-lg font-semibold">오늘의 할 일</h3>
            <span className="text-xs text-slate-400">{me.name} 담당</span>
          </div>
          <div className="mt-3 space-y-2">
            {loading && (
              <p className="py-6 text-center text-sm text-slate-400">
                불러오는 중...
              </p>
            )}
            {!loading && myTodaySubprojects.length === 0 && (
              <p className="py-6 text-center text-sm text-slate-400">
                오늘 진행 중인 본인 담당 업무가 없습니다.
              </p>
            )}
            {myTodaySubprojects.map((sp) => {
              const currentStep =
                [...sp.subtasks]
                  .sort((a, b) => a.order_index - b.order_index)
                  .find((t) => !t.is_done)?.name ?? '완료';
              return (
                <div
                  key={sp.id}
                  className="rounded-xl border border-slate-100 bg-slate-50 p-3"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{sp.name}</p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] ${STATUS_BADGE[sp.status]}`}
                    >
                      {STATUS_LABEL[sp.status]}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    현재 단계: {currentStep} · 종료 {sp.end_date}
                  </p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full bg-blue-500"
                      style={{ width: `${sp.progress}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-baseline justify-between">
            <h3 className="text-lg font-semibold">최근 소프로젝트</h3>
            <span className="text-xs text-slate-400">최신 5건</span>
          </div>
          <div className="mt-3 space-y-2">
            {loading && (
              <p className="py-6 text-center text-sm text-slate-400">
                불러오는 중...
              </p>
            )}
            {!loading && recentSubprojects.length === 0 && (
              <p className="py-6 text-center text-sm text-slate-400">
                아직 등록된 소프로젝트가 없습니다.
              </p>
            )}
            {recentSubprojects.map((sp) => {
              const project = projects.find((p) => p.id === sp.project_id);
              return (
                <div
                  key={sp.id}
                  className="rounded-xl border border-slate-100 bg-slate-50 p-3"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{sp.name}</p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] ${STATUS_BADGE[sp.status]}`}
                    >
                      {STATUS_LABEL[sp.status]}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {project?.name ?? `프로젝트 #${sp.project_id}`} ·{' '}
                    {sp.assignee?.name ?? '담당자 미지정'} · {sp.start_date} ~{' '}
                    {sp.end_date}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

type KpiProps = {
  label: string;
  value: number;
  hint?: string;
  loading?: boolean;
  accent?: 'normal' | 'warn';
};

function KpiCard({ label, value, hint, loading, accent = 'normal' }: KpiProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p
        className={`mt-2 text-3xl font-bold ${
          accent === 'warn' ? 'text-amber-600' : 'text-blue-600'
        }`}
      >
        {loading ? '—' : value}
      </p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}
