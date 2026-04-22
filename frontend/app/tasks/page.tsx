'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import AppShell from '../components/AppShell';
import ChatBot from '../components/ChatBot';
import { useMe } from '../lib/useMe';
import { useDashboardData } from '../dashboard/hooks/useDashboardData';
import { colorForId } from '../components/AppShell/colors';

export default function TasksPage() {
  const { me, loading: meLoading } = useMe();
  const {
    projects,
    subprojects,
    users,
    loading,
    error,
  } = useDashboardData(!!me);

  if (meLoading || !me) {
    return <main className="p-8 text-slate-900">불러오는 중...</main>;
  }

  const activeSubprojects = subprojects.filter(
    (subproject) => subproject.status !== 'completed',
  );
  const unassigned = activeSubprojects.filter(
    (subproject) => subproject.assignee_id === null,
  );
  const overdueSoon = activeSubprojects
    .filter((subproject) => daysUntil(subproject.end_date) <= 7)
    .sort((left, right) => daysUntil(left.end_date) - daysUntil(right.end_date))
    .slice(0, 5);

  const memberLoad = users
    .map((user) => ({
      user,
      count: activeSubprojects.filter(
        (subproject) => subproject.assignee_id === user.id,
      ).length,
      avgProgress: average(
        activeSubprojects
          .filter((subproject) => subproject.assignee_id === user.id)
          .map((subproject) => subproject.progress),
      ),
    }))
    .filter((entry) => entry.count > 0)
    .sort((left, right) => right.count - left.count);

  const projectPressure = projects
    .map((project) => {
      const items = activeSubprojects.filter(
        (subproject) => subproject.project_id === project.id,
      );
      return {
        project,
        count: items.length,
        avgProgress: average(items.map((item) => item.progress)),
      };
    })
    .filter((entry) => entry.count > 0)
    .sort((left, right) => left.avgProgress - right.avgProgress)
    .slice(0, 4);

  return (
    <AppShell me={me} sidebarProjects={projects} sidebarUsers={users}>
      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">AI 업무 배정</h1>
          <p className="mt-1 text-sm text-slate-500">
            현재 진행 중인 프로젝트를 기준으로 우선순위와 재배치 힌트를 정리했습니다.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/team-calendar"
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            팀 캘린더 보기
          </Link>
          <Link
            href="/projects"
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            프로젝트 관리
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="진행 중 업무"
          value={loading ? '—' : String(activeSubprojects.length)}
          hint="완료되지 않은 소프로젝트"
        />
        <StatCard
          label="미배정 업무"
          value={loading ? '—' : String(unassigned.length)}
          hint="담당자 배정이 필요한 항목"
        />
        <StatCard
          label="마감 임박"
          value={loading ? '—' : String(overdueSoon.length)}
          hint="7일 안에 종료되는 업무"
        />
        <StatCard
          label="참여 팀원"
          value={loading ? '—' : String(memberLoad.length)}
          hint="현재 업무를 맡고 있는 인원"
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]">
        <section className="space-y-6">
          <Panel
            title="우선 조정이 필요한 프로젝트"
            description="평균 진척률이 낮고 아직 진행 중인 프로젝트를 먼저 보여줍니다."
          >
            {projectPressure.length === 0 ? (
              <EmptyState text="아직 추천할 프로젝트가 없습니다." />
            ) : (
              <div className="space-y-3">
                {projectPressure.map(({ project, count, avgProgress }) => (
                  <Link
                    key={project.id}
                    href={`/projects/${project.id}`}
                    className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 hover:border-indigo-200 hover:bg-indigo-50/40"
                  >
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${colorForId(project.id)}`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {project.name}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        진행 중 업무 {count}건 · 평균 진척률 {Math.round(avgProgress)}%
                      </p>
                    </div>
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-micro font-semibold text-amber-700">
                      점검 권장
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </Panel>

          <Panel
            title="담당자 재배치 후보"
            description="현재 업무 수가 많은 순서대로 확인해 배분을 조정할 수 있습니다."
          >
            {memberLoad.length === 0 ? (
              <EmptyState text="현재 배정된 업무가 없습니다." />
            ) : (
              <div className="space-y-3">
                {memberLoad.slice(0, 5).map(({ user, count, avgProgress }) => (
                  <div
                    key={user.id}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {user.name}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          진행 중 업무 {count}건 · 평균 진척률 {Math.round(avgProgress)}%
                        </p>
                      </div>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-micro font-semibold text-slate-600">
                        {user.role === 'admin' ? '관리자' : '팀원'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </section>

        <section className="space-y-6">
          <Panel
            title="즉시 배정 필요"
            description="담당자가 비어 있는 소프로젝트입니다."
          >
            {unassigned.length === 0 ? (
              <EmptyState text="현재 미배정 업무가 없습니다." />
            ) : (
              <div className="space-y-3">
                {unassigned.slice(0, 6).map((subproject) => (
                  <div
                    key={subproject.id}
                    className="rounded-xl border border-dashed border-rose-200 bg-rose-50 px-4 py-3"
                  >
                    <p className="text-sm font-semibold text-slate-900">
                      {subproject.name}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {subproject.start_date} ~ {subproject.end_date}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel
            title="마감 임박 업무"
            description="이번 주 안에 확인이 필요한 항목입니다."
          >
            {overdueSoon.length === 0 ? (
              <EmptyState text="임박한 업무가 없습니다." />
            ) : (
              <div className="space-y-3">
                {overdueSoon.map((subproject) => (
                  <div
                    key={subproject.id}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-900">
                        {subproject.name}
                      </p>
                      <span className="rounded-full bg-rose-100 px-2 py-0.5 text-micro font-semibold text-rose-700">
                        D-{Math.max(daysUntil(subproject.end_date), 0)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      담당자 {subproject.assignee?.name ?? '미배정'} · 종료일 {subproject.end_date}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </section>
      </div>

      <ChatBot />
    </AppShell>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-400">{hint}</p>
    </div>
  );
}

function Panel({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      {children}
    </section>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <p className="rounded-xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-400">
      {text}
    </p>
  );
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function daysUntil(date: string) {
  const target = new Date(`${date}T00:00:00`);
  const now = new Date();
  const diff = target.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}
