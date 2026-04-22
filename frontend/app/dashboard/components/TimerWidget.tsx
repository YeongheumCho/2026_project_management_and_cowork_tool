'use client';

import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import Modal from '../../components/Modal';
import {
  apiFetch,
  type SubProject,
  type WorkLog,
} from '../../lib/api';

type Props = {
  candidates: SubProject[];
  projectName?: string;
  helperText?: string;
};

type PendingStart = {
  subprojectId: number | null;
  taskName: string;
};

export default function TimerWidget({
  candidates,
  projectName,
  helperText,
}: Props) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [manualTaskName, setManualTaskName] = useState('');
  const [logs, setLogs] = useState<WorkLog[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [tick, setTick] = useState(Date.now());
  const [pendingStart, setPendingStart] = useState<PendingStart | null>(null);

  const selected = useMemo(
    () => candidates.find((candidate) => candidate.id === selectedId) ?? null,
    [candidates, selectedId],
  );

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
  const primaryRunningLog = runningLogs[0] ?? null;

  useEffect(() => {
    setSelectedId((current) => {
      if (current && candidates.some((candidate) => candidate.id === current)) {
        return current;
      }
      return candidates[0]?.id ?? null;
    });
  }, [candidates]);

  useEffect(() => {
    void loadLogs();
  }, []);

  useEffect(() => {
    if (runningLogs.length === 0) return undefined;
    const intervalId = window.setInterval(() => setTick(Date.now()), 1000);
    return () => window.clearInterval(intervalId);
  }, [runningLogs.length]);

  async function loadLogs() {
    try {
      const nextLogs = await apiFetch<WorkLog[]>('/work-logs');
      setLogs(nextLogs);
      setError('');
    } catch (nextError) {
      setError((nextError as Error).message);
    }
  }

  async function startTask(taskName: string, continueWithIds: number[] = []) {
    setBusy(true);
    try {
      await apiFetch<WorkLog>('/work-logs/start', {
        method: 'POST',
        body: JSON.stringify({
          subproject_id: selected?.id ?? null,
          task_name: taskName,
          continue_with_ids: continueWithIds,
        }),
      });
      setManualTaskName('');
      setPendingStart(null);
      await loadLogs();
    } catch (nextError) {
      setError((nextError as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleStart() {
    const taskName = selected?.name ?? manualTaskName.trim();
    if (!taskName) return;

    if (runningLogs.length > 0) {
      setPendingStart({
        subprojectId: selected?.id ?? null,
        taskName,
      });
      return;
    }

    await startTask(taskName);
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
    } catch (nextError) {
      setError((nextError as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const bigTimerSeconds = primaryRunningLog
    ? getElapsedSeconds(primaryRunningLog, tick)
    : 0;

  return (
    <>
      <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        {error && (
          <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="flex flex-wrap items-start gap-6">
          <div>
            <p className="font-mono text-4xl font-bold tabular-nums tracking-tight text-slate-900">
              {formatHMS(bigTimerSeconds)}
            </p>
            <p className="mt-2 text-xs text-slate-500">
              {primaryRunningLog
                ? `${primaryRunningLog.task_name} 진행 중`
                : '진행 중인 작업이 없습니다.'}
            </p>
          </div>

          <div className="min-w-[260px] flex-1">
            <p className="text-lg font-semibold text-slate-900">
              {projectName ?? '선택된 프로젝트 없음'}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {helperText ?? '오늘 수행할 업무를 선택한 뒤 타이머를 시작하세요.'}
            </p>

            <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
              <select
                value={selectedId ?? ''}
                onChange={(event) =>
                  setSelectedId(
                    event.target.value ? Number(event.target.value) : null,
                  )
                }
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <option value="">오늘 배정된 업무 선택</option>
                {candidates.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.name}
                  </option>
                ))}
              </select>

              <input
                value={manualTaskName}
                onChange={(event) => setManualTaskName(event.target.value)}
                placeholder="또는 직접 작업명 입력"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>

            {selected && (
              <p className="mt-2 text-xs text-slate-500">
                {selected.start_date} ~ {selected.end_date} · 진척률{' '}
                {Math.round(selected.progress)}%
              </p>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              <ActionButton
                onClick={handleStart}
                disabled={busy || (!selected && !manualTaskName.trim())}
                tone="emerald"
                label="시작"
              />
              {primaryRunningLog && (
                <ActionButton
                  onClick={() => mutateLog(primaryRunningLog.id, 'pause')}
                  disabled={busy}
                  tone="amber"
                  label="일시정지"
                />
              )}
              {pausedLogs[0] && (
                <ActionButton
                  onClick={() => mutateLog(pausedLogs[0].id, 'resume')}
                  disabled={busy}
                  tone="slate"
                  label="재개"
                />
              )}
              {primaryRunningLog && (
                <ActionButton
                  onClick={() => mutateLog(primaryRunningLog.id, 'complete')}
                  disabled={busy}
                  tone="rose"
                  label="완료"
                />
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <TimerColumn
            title="진행 중 / 대기 중"
            emptyText="오늘 등록된 작업이 없습니다."
            items={[...runningLogs, ...pausedLogs]}
            renderItem={(log) => (
              <LogCard
                key={log.id}
                log={log}
                onPause={() => mutateLog(log.id, 'pause')}
                onResume={() => mutateLog(log.id, 'resume')}
                onComplete={() => mutateLog(log.id, 'complete')}
                onDelete={() => mutateLog(log.id, 'delete')}
                busy={busy}
                now={tick}
              />
            )}
          />

          <TimerColumn
            title="완료 작업"
            emptyText="아직 완료한 작업이 없습니다."
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
      </section>

      <Modal
        open={pendingStart !== null}
        onClose={() => setPendingStart(null)}
        size="sm"
        ariaLabel="동시 진행 선택"
      >
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              이미 진행 중인 작업이 있습니다
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              새 작업을 시작하면 기존 작업을 자동으로 일시정지하거나, 동시 진행으로
              유지할 수 있습니다.
            </p>
          </div>

          <div className="space-y-2 rounded-xl bg-slate-50 p-3">
            {runningLogs.map((log) => (
              <p key={log.id} className="text-sm text-slate-700">
                {log.task_name} · {formatHMS(getElapsedSeconds(log, tick))}
              </p>
            ))}
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => setPendingStart(null)}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              취소
            </button>
            <button
              type="button"
              disabled={!pendingStart || busy}
              onClick={() =>
                pendingStart && startTask(pendingStart.taskName, [])
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
                startTask(
                  pendingStart.taskName,
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
    <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        <span className="text-xs text-slate-400">{items.length}건</span>
      </div>
      <div className="space-y-3">
        {items.length === 0 ? (
          <p className="rounded-xl bg-white px-4 py-5 text-center text-sm text-slate-400">
            {emptyText}
          </p>
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
    <article className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">{log.task_name}</p>
          <p className="mt-1 text-xs text-slate-500">
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
          <MiniButton
            label="일시정지"
            onClick={onPause}
            disabled={busy}
            tone="amber"
          />
        )}
        {log.status === 'paused' && onResume && (
          <MiniButton
            label="재개"
            onClick={onResume}
            disabled={busy}
            tone="slate"
          />
        )}
        {log.status !== 'completed' && onComplete && (
          <MiniButton
            label="완료"
            onClick={onComplete}
            disabled={busy}
            tone="emerald"
          />
        )}
        <MiniButton
          label="삭제"
          onClick={onDelete}
          disabled={busy}
          tone="rose"
        />
      </div>
    </article>
  );
}

function ActionButton({
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
      className={`rounded-xl px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${BUTTON_TONE[tone]}`}
    >
      {label}
    </button>
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
  slate: 'bg-slate-100 text-slate-700 hover:bg-slate-200',
};

const STATUS_LABEL = {
  running: '진행 중',
  paused: '일시정지',
  completed: '완료',
};

const STATUS_BADGE = {
  running: 'bg-emerald-100 text-emerald-700',
  paused: 'bg-amber-100 text-amber-700',
  completed: 'bg-slate-200 text-slate-700',
};

function getElapsedSeconds(log: WorkLog, now: number) {
  if (log.status !== 'running' || !log.current_started_at) {
    return log.duration_sec;
  }
  const currentStartedAt = new Date(log.current_started_at).getTime();
  return log.duration_sec + Math.max(0, Math.floor((now - currentStartedAt) / 1000));
}

function formatHMS(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds]
    .map((value) => String(value).padStart(2, '0'))
    .join(':');
}
