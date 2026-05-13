'use client';

import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import Modal from '../../components/Modal';
import {
  apiFetch,
  type Project,
  type SubProject,
  type WorkLog,
} from '../../lib/api';

type Props = {
  candidates: SubProject[];
  projects?: Project[];
};

type PendingStart = {
  candidate: SubProject;
};

export default function TimerWidget({ candidates, projects }: Props) {
  const [logs, setLogs] = useState<WorkLog[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [tick, setTick] = useState(Date.now());
  const [pendingStart, setPendingStart] = useState<PendingStart | null>(null);

  const projectNameById = useMemo(() => {
    if (!projects) return new Map<number, string>();
    return new Map(projects.map((p) => [p.id, p.name]));
  }, [projects]);

  const runningLogs = useMemo(
    () => logs.filter((log) => log.status === 'running'),
    [logs],
  );
  const pausedLogs = useMemo(
    () => logs.filter((log) => log.status === 'paused'),
    [logs],
  );
  const completedLogs = useMemo(
    () => logs.filter((log) => log.status === 'completed').slice(0, 5),
    [logs],
  );

  // Map active (non-completed) work logs by subproject_id for quick card lookup
  const activeLogBySub = useMemo(() => {
    const map = new Map<number, WorkLog>();
    for (const log of logs) {
      if (log.status !== 'completed' && log.subproject_id !== null) {
        map.set(log.subproject_id, log);
      }
    }
    return map;
  }, [logs]);

  useEffect(() => {
    void loadLogs();
  }, []);

  useEffect(() => {
    if (runningLogs.length === 0) return undefined;
    const id = window.setInterval(() => setTick(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [runningLogs.length]);

  async function loadLogs() {
    try {
      const next = await apiFetch<WorkLog[]>('/work-logs');
      setLogs(next);
      setError('');
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function startTask(candidate: SubProject, continueWithIds: number[] = []) {
    setBusy(true);
    try {
      await apiFetch<WorkLog>('/work-logs/start', {
        method: 'POST',
        body: JSON.stringify({
          subproject_id: candidate.id,
          task_name: candidate.name,
          continue_with_ids: continueWithIds,
        }),
      });
      setPendingStart(null);
      await loadLogs();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function handleStart(candidate: SubProject) {
    if (runningLogs.length > 0) {
      setPendingStart({ candidate });
      return;
    }
    void startTask(candidate);
  }

  async function mutateLog(
    logId: number,
    action: 'pause' | 'resume' | 'complete' | 'delete',
  ) {
    setBusy(true);
    try {
      if (action === 'delete') {
        await apiFetch<void>(`/work-logs/${logId}`, { method: 'DELETE' });
      } else if (action === 'complete') {
        await apiFetch<WorkLog>(`/work-logs/${logId}/complete`, {
          method: 'POST',
          body: JSON.stringify({ archived_ids: [] }),
        });
      } else {
        await apiFetch<WorkLog>(`/work-logs/${logId}/${action}`, {
          method: 'POST',
        });
      }
      await loadLogs();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <section className="mt-4 rounded-2xl border border-border bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-text">
            스톱워치 — 오늘 담당 업무
          </h2>
          {runningLogs.length > 0 && (
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
              {runningLogs.length}개 진행 중
            </span>
          )}
        </div>

        {error && (
          <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}

        {candidates.length === 0 ? (
          <p className="rounded-xl border border-border bg-surface-muted px-4 py-6 text-center text-sm text-text-faint">
            오늘 날짜 범위에 해당하는 담당 하위 프로젝트가 없습니다.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {candidates.map((candidate) => {
              const activeLog = activeLogBySub.get(candidate.id);
              const elapsed = activeLog
                ? getElapsedSeconds(activeLog, tick)
                : 0;
              const projName = projectNameById.get(candidate.project_id);
              const isRunning = activeLog?.status === 'running';
              const isPaused = activeLog?.status === 'paused';

              return (
                <article
                  key={candidate.id}
                  className={`rounded-xl border p-4 transition ${
                    isRunning
                      ? 'border-emerald-200 bg-emerald-50'
                      : isPaused
                        ? 'border-amber-200 bg-amber-50'
                        : 'border-border bg-white'
                  }`}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-text">
                        {candidate.name}
                      </p>
                      {projName && (
                        <p className="truncate text-xs text-text-faint">
                          {projName}
                        </p>
                      )}
                    </div>
                    {activeLog && (
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_BADGE[activeLog.status]}`}
                      >
                        {STATUS_LABEL[activeLog.status]}
                      </span>
                    )}
                  </div>

                  {/* Elapsed timer */}
                  {activeLog ? (
                    <p className="mt-2 font-mono text-2xl font-bold tabular-nums tracking-tight text-text">
                      {formatHMS(elapsed)}
                    </p>
                  ) : (
                    <p className="mt-2 text-xs text-text-faint">
                      진척률 {Math.round(candidate.progress)}%
                    </p>
                  )}

                  {/* Action buttons */}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {!activeLog && (
                      <MiniButton
                        label="시작"
                        onClick={() => handleStart(candidate)}
                        disabled={busy}
                        tone="emerald"
                      />
                    )}
                    {isRunning && (
                      <>
                        <MiniButton
                          label="일시정지"
                          onClick={() => mutateLog(activeLog.id, 'pause')}
                          disabled={busy}
                          tone="amber"
                        />
                        <MiniButton
                          label="완료"
                          onClick={() => mutateLog(activeLog.id, 'complete')}
                          disabled={busy}
                          tone="rose"
                        />
                      </>
                    )}
                    {isPaused && (
                      <>
                        <MiniButton
                          label="재개"
                          onClick={() => mutateLog(activeLog.id, 'resume')}
                          disabled={busy}
                          tone="slate"
                        />
                        <MiniButton
                          label="완료"
                          onClick={() => mutateLog(activeLog.id, 'complete')}
                          disabled={busy}
                          tone="rose"
                        />
                      </>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* Completed logs */}
        {completedLogs.length > 0 && (
          <div className="mt-6">
            <TimerColumn
              title="완료 작업"
              emptyText=""
              items={completedLogs}
              renderItem={(log) => (
                <LogCard
                  key={log.id}
                  log={log}
                  onDelete={() => mutateLog(log.id, 'delete')}
                  busy={busy}
                  now={tick}
                />
              )}
            />
          </div>
        )}

        {/* Paused logs not linked to any candidate */}
        {pausedLogs.filter((l) => !candidates.some((c) => c.id === l.subproject_id)).length > 0 && (
          <div className="mt-4">
            <TimerColumn
              title="일시정지 (기타)"
              emptyText=""
              items={pausedLogs.filter(
                (l) => !candidates.some((c) => c.id === l.subproject_id),
              )}
              renderItem={(log) => (
                <LogCard
                  key={log.id}
                  log={log}
                  onResume={() => mutateLog(log.id, 'resume')}
                  onComplete={() => mutateLog(log.id, 'complete')}
                  onDelete={() => mutateLog(log.id, 'delete')}
                  busy={busy}
                  now={tick}
                />
              )}
            />
          </div>
        )}
      </section>

      {/* Pending start modal */}
      <Modal
        open={pendingStart !== null}
        onClose={() => setPendingStart(null)}
        size="sm"
        ariaLabel="동시 진행 선택"
      >
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-text">
              이미 진행 중인 작업이 있습니다
            </h2>
            <p className="mt-1 text-sm text-text-subtle">
              새 작업을 시작하면 기존 작업을 자동으로 일시정지하거나, 동시 진행으로
              유지할 수 있습니다.
            </p>
          </div>

          <div className="space-y-2 rounded-xl bg-surface-muted p-3">
            {runningLogs.map((log) => (
              <p key={log.id} className="text-sm text-text">
                {log.task_name} · {formatHMS(getElapsedSeconds(log, tick))}
              </p>
            ))}
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => setPendingStart(null)}
              className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-text-muted hover:bg-surface-muted"
            >
              취소
            </button>
            <button
              type="button"
              disabled={!pendingStart || busy}
              onClick={() =>
                pendingStart && void startTask(pendingStart.candidate, [])
              }
              className="rounded-xl border border-amber-200 px-4 py-2 text-sm font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-50"
            >
              기존 작업 일시정지
            </button>
            <button
              type="button"
              disabled={!pendingStart || busy}
              onClick={() =>
                pendingStart &&
                void startTask(
                  pendingStart.candidate,
                  runningLogs.map((log) => log.id),
                )
              }
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              동시 진행 유지
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

function TimerColumn<T>({
  title,
  items,
  emptyText,
  renderItem,
}: {
  title: string;
  items: T[];
  emptyText: string;
  renderItem: (item: T) => ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-surface-muted p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text">{title}</h3>
        <span className="text-xs text-text-faint">{items.length}건</span>
      </div>
      <div className="space-y-3">
        {items.length === 0 ? (
          emptyText ? (
            <p className="rounded-xl bg-white px-4 py-5 text-center text-sm text-text-faint">
              {emptyText}
            </p>
          ) : null
        ) : (
          items.map(renderItem)
        )}
      </div>
    </section>
  );
}

function LogCard({
  log,
  onPause,
  onResume,
  onComplete,
  onDelete,
  busy,
  now,
}: {
  log: WorkLog;
  onPause?: () => void;
  onResume?: () => void;
  onComplete?: () => void;
  onDelete: () => void;
  busy: boolean;
  now: number;
}) {
  const elapsed = getElapsedSeconds(log, now);

  return (
    <article className="rounded-xl border border-border bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-text">{log.task_name}</p>
          <p className="mt-1 text-xs text-text-subtle">
            {STATUS_LABEL[log.status]} · {formatHMS(elapsed)}
          </p>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[log.status]}`}
        >
          {STATUS_LABEL[log.status]}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {log.status === 'running' && onPause && (
          <MiniButton label="일시정지" onClick={onPause} disabled={busy} tone="amber" />
        )}
        {log.status === 'paused' && onResume && (
          <MiniButton label="재개" onClick={onResume} disabled={busy} tone="slate" />
        )}
        {log.status !== 'completed' && onComplete && (
          <MiniButton label="완료" onClick={onComplete} disabled={busy} tone="emerald" />
        )}
        <MiniButton label="삭제" onClick={onDelete} disabled={busy} tone="rose" />
      </div>
    </article>
  );
}

function MiniButton({
  label,
  onClick,
  disabled,
  tone,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
  tone: 'emerald' | 'amber' | 'rose' | 'slate';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${BUTTON_TONE[tone]}`}
    >
      {label}
    </button>
  );
}

const BUTTON_TONE = {
  emerald: 'bg-emerald-600 text-white hover:bg-emerald-700',
  amber: 'bg-amber-100 text-amber-800 hover:bg-amber-200',
  rose: 'bg-rose-100 text-rose-700 hover:bg-rose-200',
  slate: 'bg-surface-subtle text-text hover:bg-slate-200',
};

const STATUS_LABEL = {
  running: '진행 중',
  paused: '일시정지',
  completed: '완료',
};

const STATUS_BADGE = {
  running: 'bg-emerald-100 text-emerald-700',
  paused: 'bg-amber-100 text-amber-700',
  completed: 'bg-slate-200 text-text',
};

function getElapsedSeconds(log: WorkLog, now: number) {
  if (log.status !== 'running' || !log.current_started_at) {
    return log.duration_sec;
  }
  const started = new Date(log.current_started_at).getTime();
  return log.duration_sec + Math.max(0, Math.floor((now - started) / 1000));
}

function formatHMS(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':');
}
