'use client';

import { FormEvent, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import AppShell from '../../components/AppShell';
import {
  apiFetch,
  type ProgressLog,
  type Project,
  type SubProject,
} from '../../lib/api';
import { toISODate } from '../../lib/calendar';
import { useMe } from '../../lib/useMe';

export default function ProjectDetailPage() {
  return (
    <Suspense fallback={<main className="p-8 text-text">불러오는 중...</main>}>
      <ProjectDetailContent />
    </Suspense>
  );
}

function ProjectDetailContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const projectId = Number(params?.id);
  const subprojectIdParam = searchParams.get('subprojectId');
  const subprojectId = subprojectIdParam ? Number(subprojectIdParam) : null;
  const isSubprojectMode = Number.isFinite(subprojectId);
  const { me, loading: meLoading } = useMe();

  const [project, setProject] = useState<Project | null>(null);
  const [subprojects, setSubprojects] = useState<SubProject[]>([]);
  const [logs, setLogs] = useState<ProgressLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const [progressPercent, setProgressPercent] = useState('');
  const [comment, setComment] = useState('');
  const [workDate, setWorkDate] = useState(toISODate(new Date()));

  const selectedSubproject = useMemo(
    () => subprojects.find((item) => item.id === subprojectId) ?? null,
    [subprojectId, subprojects],
  );

  const load = useCallback(async () => {
    if (!Number.isFinite(projectId)) return;
    setLoading(true);
    try {
      const progressPath = isSubprojectMode
        ? `/subprojects/${subprojectId}/progress`
        : `/projects/${projectId}/progress`;
      const [projects, fetchedSubprojects, fetchedLogs] = await Promise.all([
        apiFetch<Project[]>('/projects'),
        apiFetch<SubProject[]>(`/subprojects?project_id=${projectId}`),
        apiFetch<ProgressLog[]>(progressPath),
      ]);
      const found = projects.find((item) => item.id === projectId) ?? null;
      setProject(found);
      setSubprojects(fetchedSubprojects);
      setLogs(fetchedLogs);
      if (!found) setMessage('프로젝트를 찾을 수 없습니다.');
      else setMessage('');
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [isSubprojectMode, projectId, subprojectId]);

  useEffect(() => {
    if (me) void load();
  }, [me, load]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!Number.isFinite(projectId)) return;
    const n = Number(progressPercent);
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      setMessage('진행률은 0~100 사이 숫자여야 합니다.');
      return;
    }

    try {
      const progressPath = isSubprojectMode
        ? `/subprojects/${subprojectId}/progress`
        : `/projects/${projectId}/progress`;
      await apiFetch<ProgressLog>(progressPath, {
        method: 'POST',
        body: JSON.stringify({
          progress_percent: n,
          comment: comment.trim() || null,
          work_date: workDate,
        }),
      });
      setProgressPercent('');
      setComment('');
      setMessage(
        isSubprojectMode
          ? '진행률 기록이 저장되고 하위 프로젝트 진행률에 반영되었습니다.'
          : '진행률 기록이 저장되었습니다.',
      );
      await load();
    } catch (err) {
      setMessage((err as Error).message);
    }
  };

  if (meLoading || !me) {
    return <main className="p-8 text-text">불러오는 중...</main>;
  }

  const title = selectedSubproject?.name ?? project?.name ?? '진행률 기록';
  const subtitle = selectedSubproject
    ? `${project?.name ?? '프로젝트'} · ${selectedSubproject.start_date} ~ ${selectedSubproject.end_date} · 현재 ${Math.round(selectedSubproject.progress)}%`
    : project
      ? `${new Date(project.created_at).toLocaleDateString('ko-KR')} 생성 · 유형: ${project.project_type}`
      : '프로젝트 정보를 표시할 수 없습니다.';

  return (
    <AppShell me={me}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text">{title}</h1>
        <p className="mt-1 text-xs text-text-subtle">{subtitle}</p>
      </div>

      {message && (
        <p className="mb-4 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-700">
          {message}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="flex flex-col rounded-2xl border border-border bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">진행률 기록 추가</h2>
          <p className="mt-1 text-xs text-text-subtle">
            {isSubprojectMode
              ? '본인에게 배정된 하위 프로젝트의 현재 진행률을 기록합니다.'
              : '프로젝트에서 수행한 업무 진행률과 메모를 기록합니다.'}
          </p>

          <form onSubmit={submit} className="mt-4 flex flex-1 flex-col gap-3">
            <label className="block">
              <span className="text-xs font-medium text-text-muted">진행률 (%)</span>
              <input
                type="number"
                min={0}
                max={100}
                value={progressPercent}
                onChange={(event) => setProgressPercent(event.target.value)}
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
                required
              />
            </label>

            <label className="block">
              <span className="text-xs font-medium text-text-muted">날짜</span>
              <input
                type="date"
                value={workDate}
                onChange={(event) => setWorkDate(event.target.value)}
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
                required
              />
            </label>

            <label className="block flex-1">
              <span className="text-xs font-medium text-text-muted">메모</span>
              <textarea
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                placeholder="오늘 한 일, 이슈, 다음 계획"
                className="mt-1 min-h-[96px] w-full rounded-lg border border-border px-3 py-2 text-sm"
              />
            </label>

            <button
              type="submit"
              className="self-start rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-strong"
            >
              기록 저장
            </button>
          </form>
        </section>

        <section className="flex flex-col rounded-2xl border border-border bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">수행 이력</h2>
          <p className="mt-1 text-xs text-text-subtle">
            {isSubprojectMode
              ? '선택한 하위 프로젝트의 진행률 기록입니다.'
              : '이 프로젝트에서 남긴 진행률 기록입니다.'}
          </p>

          <div className="mt-4 flex-1 space-y-2 overflow-y-auto">
            {loading && (
              <p className="py-6 text-center text-sm text-text-faint">
                불러오는 중...
              </p>
            )}
            {!loading && logs.length === 0 && (
              <p className="py-6 text-center text-sm text-text-faint">
                아직 진행 기록이 없습니다.
              </p>
            )}
            {logs.map((log) => (
              <div
                key={log.id}
                className="rounded-xl border border-border-subtle bg-surface-muted p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-text">{log.progress_percent}%</p>
                  <p className="shrink-0 text-xs text-text-subtle">{log.work_date}</p>
                </div>
                <p className="mt-1 text-xs text-text-muted">
                  {log.comment || '메모 없음'}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
