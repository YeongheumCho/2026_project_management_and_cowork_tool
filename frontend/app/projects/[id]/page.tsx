'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import AppShell from '../../components/AppShell';
import { apiFetch, type Project } from '../../lib/api';
import { toISODate } from '../../lib/calendar';
import { useMe } from '../../lib/useMe';

type ProgressLog = {
  id: number;
  project_id: number;
  user_id: number;
  progress_percent: number;
  comment: string | null;
  work_date: string;
  created_at: string;
};

export default function ProjectDetailPage() {
  const params = useParams();
  const projectId = Number(params?.id);
  const { me, loading: meLoading } = useMe();

  const [project, setProject] = useState<Project | null>(null);
  const [logs, setLogs] = useState<ProgressLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const [progressPercent, setProgressPercent] = useState('');
  const [comment, setComment] = useState('');
  const [workDate, setWorkDate] = useState(toISODate(new Date()));

  const load = useCallback(async () => {
    if (!Number.isFinite(projectId)) return;
    setLoading(true);
    try {
      const [projects, fetchedLogs] = await Promise.all([
        apiFetch<Project[]>('/projects'),
        apiFetch<ProgressLog[]>(`/projects/${projectId}/progress`),
      ]);
      const found = projects.find((p) => p.id === projectId) ?? null;
      setProject(found);
      setLogs(fetchedLogs);
      if (!found) setMessage('프로젝트를 찾을 수 없습니다.');
      else setMessage('');
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (me) void load();
  }, [me, load]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!Number.isFinite(projectId)) return;
    const n = Number(progressPercent);
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      setMessage('진행률은 0~100 사이 숫자여야 합니다.');
      return;
    }
    try {
      await apiFetch<ProgressLog>(`/projects/${projectId}/progress`, {
        method: 'POST',
        body: JSON.stringify({
          progress_percent: n,
          comment: comment.trim() || null,
          work_date: workDate,
        }),
      });
      setProgressPercent('');
      setComment('');
      setMessage('진행 기록이 저장되었습니다.');
      await load();
    } catch (err) {
      setMessage((err as Error).message);
    }
  };

  if (meLoading || !me) {
    return <main className="p-8 text-text">불러오는 중...</main>;
  }

  return (
    <AppShell me={me}>
      <div className="mb-4">
        <Link href="/projects" className="text-sm text-blue-600 hover:underline">
          {'← 프로젝트 목록'}
        </Link>
      </div>

      {project ? (
        <div className="mb-6">
          <h1 className="text-2xl font-bold">{project.name}</h1>
          <p className="mt-1 text-xs text-text-subtle">
            {'생성 '}{new Date(project.created_at).toLocaleDateString('ko-KR')}{' · 유형: '}
            {project.project_type}
          </p>
        </div>
      ) : (
        <p className="mb-6 rounded-lg bg-surface-subtle px-3 py-2 text-sm text-text-subtle">
          {loading ? '불러오는 중...' : '프로젝트 정보를 표시할 수 없습니다.'}
        </p>
      )}

      {message && (
        <p className="mb-4 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-700">
          {message}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="flex flex-col rounded-2xl border border-border bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">{'진행률 기록 추가'}</h2>
          <p className="mt-1 text-xs text-text-subtle">
            {'오늘 이 프로젝트에서 진행한 내용을 기록하세요.'}
          </p>

          <form onSubmit={submit} className="mt-4 flex flex-1 flex-col gap-3">
            <label className="block">
              <span className="text-xs font-medium text-text-muted">{'진행률 (%)'}</span>
              <input
                type="number"
                min={0}
                max={100}
                value={progressPercent}
                onChange={(e) => setProgressPercent(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
                required
              />
            </label>

            <label className="block">
              <span className="text-xs font-medium text-text-muted">{'날짜'}</span>
              <input
                type="date"
                value={workDate}
                onChange={(e) => setWorkDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
                required
              />
            </label>

            <label className="block flex-1">
              <span className="text-xs font-medium text-text-muted">{'메모'}</span>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="오늘 한 일 / 이슈 / 다음 계획"
                className="mt-1 min-h-[96px] w-full rounded-lg border border-border px-3 py-2 text-sm"
              />
            </label>

            <button
              type="submit"
              className="self-start rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              {'기록 저장'}
            </button>
          </form>
        </section>

        <section className="flex flex-col rounded-2xl border border-border bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">{'수행 이력'}</h2>
          <p className="mt-1 text-xs text-text-subtle">
            {'이 프로젝트에서 남긴 진행 기록입니다.'}
          </p>

          <div className="mt-4 flex-1 space-y-2 overflow-y-auto">
            {loading && (
              <p className="py-6 text-center text-sm text-text-faint">
                {'불러오는 중...'}
              </p>
            )}
            {!loading && logs.length === 0 && (
              <p className="py-6 text-center text-sm text-text-faint">
                {'아직 진행 기록이 없습니다.'}
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
