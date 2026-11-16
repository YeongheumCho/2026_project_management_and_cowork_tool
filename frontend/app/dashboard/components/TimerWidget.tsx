'use client';

import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import Modal from '../../components/Modal';
import {
  apiFetch,
  TIME_ENTRY_FIELD_LABEL,
  TIME_ENTRY_STAGE_LABEL,
  TIME_ENTRY_STAGES,
  type Project,
  type SubProject,
  type TimeEntryPart,
  type TimeEntryStage,
  type WorkLog,
} from '../../lib/api';

// B-111: 스톱워치가 잰 시간을 '검증 시간'의 어느 칸에 자동으로 더할지.
// 값은 "단계:칸" (예: first_verify:setup), 빈 문자열이면 검증 시간에 넣지 않는다.
const TIME_PARTS: TimeEntryPart[] = ['setup', 'aud', 'work'];
const TIME_TARGET_OPTIONS: { value: string; label: string }[] = TIME_ENTRY_STAGES.flatMap(
  (stage) =>
    TIME_PARTS.flatMap((part) => {
      const partLabel = TIME_ENTRY_FIELD_LABEL[stage][part];
      if (!partLabel) return [];
      return [
        {
          value: `${stage}:${part}`,
          label: `${TIME_ENTRY_STAGE_LABEL[stage]} · ${partLabel.replace('(분)', '')}`,
        },
      ];
    }),
);
const DEFAULT_TIME_TARGET = 'first_verify:setup';
const TIME_TARGET_KEY = 'surelog.timer.timeTarget';

function parseTimeTarget(value: string): {
  time_stage: TimeEntryStage | null;
  time_part: TimeEntryPart | null;
} {
  const [stage, part] = value.split(':');
  if (!stage || !part) return { time_stage: null, time_part: null };
  return { time_stage: stage as TimeEntryStage, time_part: part as TimeEntryPart };
}

function logTimeTarget(log: WorkLog): string {
  return log.time_stage && log.time_part ? `${log.time_stage}:${log.time_part}` : '';
}

function readStoredTimeTarget(): string {
  try {
    const stored = window.localStorage.getItem(TIME_TARGET_KEY);
    if (stored === '' || TIME_TARGET_OPTIONS.some((option) => option.value === stored)) {
      return stored ?? DEFAULT_TIME_TARGET;
    }
  } catch {
    // 저장소를 쓸 수 없으면 기본값을 쓴다.
  }
  return DEFAULT_TIME_TARGET;
}

type Props = {
  candidates: SubProject[];
  projects?: Project[];
  onChanged?: () => Promise<void> | void;
  onProgressRequested?: (subproject: SubProject) => void;
};

type PendingStart = {
  candidate: SubProject;
};

export default function TimerWidget({
  candidates,
  projects,
  onChanged,
  onProgressRequested,
}: Props) {
  const [logs, setLogs] = useState<WorkLog[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [tick, setTick] = useState(Date.now());
  // B-101: 진행 시간은 "현재 시각 - 서버가 기록한 시작 시각"으로 센다.
  // PC 시계가 서버보다 빠르면 시작하자마자 그만큼(예: +50초) 더해져 보였다.
  // 서버 시각과의 차이를 기억해 두고 현재 시각에 더해 서버 기준으로 맞춘다.
  const [clockOffset, setClockOffset] = useState(0);
  const now = tick + clockOffset;
  const [pendingStart, setPendingStart] = useState<PendingStart | null>(null);
  // B-111: 시작할 때 쓸 기록 위치. 하위 프로젝트마다 고르고, 마지막에 고른 것을 기본으로 기억한다.
  const [defaultTarget, setDefaultTarget] = useState(DEFAULT_TIME_TARGET);
  const [targetBySub, setTargetBySub] = useState<Record<number, string>>({});
  useEffect(() => {
    setDefaultTarget(readStoredTimeTarget());
  }, []);

  function chooseTarget(subprojectId: number, value: string) {
    setTargetBySub((current) => ({ ...current, [subprojectId]: value }));
    setDefaultTarget(value);
    try {
      window.localStorage.setItem(TIME_TARGET_KEY, value);
    } catch {
      // 저장소를 쓸 수 없으면 이번 화면에서만 유지한다.
    }
  }

  // 재는 도중에 위치를 바꾼다 (세팅 → AUD 등). 그때까지 잰 시간은 이전 위치에 들어간다.
  async function changeLogTarget(log: WorkLog, value: string) {
    setBusy(true);
    try {
      await apiFetch<WorkLog>(`/work-logs/${log.id}/time-target`, {
        method: 'PUT',
        body: JSON.stringify(parseTimeTarget(value)),
      });
      if (log.subproject_id !== null) chooseTarget(log.subproject_id, value);
      await loadLogs();
      await onChanged?.();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

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
      const serverNow = next[0]?.server_now ? Date.parse(next[0].server_now) : NaN;
      if (!Number.isNaN(serverNow)) setClockOffset(serverNow - Date.now());
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
          ...parseTimeTarget(targetBySub[candidate.id] ?? defaultTarget),
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
      const targetLog = logs.find((log) => log.id === logId);
      const completedSubproject =
        action === 'complete' && targetLog?.subproject_id != null
          ? candidates.find(
              (candidate) => candidate.id === targetLog?.subproject_id,
            ) ?? null
          : null;

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
      await onChanged?.();
      if (completedSubproject) {
        onProgressRequested?.(completedSubproject);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const orphanPausedLogs = pausedLogs.filter(
    (log) => !candidates.some((candidate) => candidate.id === log.subproject_id),
  );

  return (
    <>
      <section className="mt-4 rounded-2xl border border-border bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-text">
              스톱워치 — 오늘 담당 업무
            </h2>
            <p className="mt-1 text-xs text-text-subtle">
              완료 및 기록을 누르면 진행률 기록 창이 이어서 열립니다. 잰 시간은 고른 위치(세팅·AUD·작성)의
              검증 시간에 자동으로 더해지므로 따로 입력하지 않아도 됩니다.
            </p>
          </div>
          {runningLogs.length > 0 && (
            <span className="rounded-full bg-verify-pass-bg px-2.5 py-0.5 text-xs font-semibold text-verify-pass-fg">
              {runningLogs.length}건 진행 중
            </span>
          )}
        </div>

        {error && (
          <p className="mb-4 rounded-lg bg-verify-fail-bg px-3 py-2 text-sm text-verify-fail-fg">
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
                ? getElapsedSeconds(activeLog, now)
                : 0;
              const projName = projectNameById.get(candidate.project_id);
              const isRunning = activeLog?.status === 'running';
              const isPaused = activeLog?.status === 'paused';

              return (
                <article
                  key={candidate.id}
                  className={`rounded-xl border p-4 transition ${
                    isRunning
                      ? 'border-verify-pass-fg/30 bg-verify-pass-bg'
                      : isPaused
                        ? 'border-verify-warn-fg/30 bg-verify-warn-bg'
                        : 'border-border bg-white'
                  }`}
                >
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
                        className={`shrink-0 rounded-full px-2 py-0.5 text-tiny font-semibold ${STATUS_BADGE[activeLog.status]}`}
                      >
                        {STATUS_LABEL[activeLog.status]}
                      </span>
                    )}
                  </div>

                  {activeLog ? (
                    <p className="mt-2 font-mono text-2xl font-bold tabular-nums tracking-tight text-text">
                      {formatHMS(elapsed)}
                    </p>
                  ) : (
                    <p className="mt-2 text-xs text-text-faint">
                      진행률 {Math.round(candidate.progress)}%
                    </p>
                  )}

                  <label className="mt-3 block">
                    <span className="text-tiny font-semibold text-text-subtle">
                      검증 시간 자동 기록
                    </span>
                    <select
                      value={
                        activeLog
                          ? logTimeTarget(activeLog)
                          : (targetBySub[candidate.id] ?? defaultTarget)
                      }
                      disabled={busy}
                      onChange={(event) =>
                        activeLog
                          ? void changeLogTarget(activeLog, event.target.value)
                          : chooseTarget(candidate.id, event.target.value)
                      }
                      title="스톱워치로 잰 시간이 이 하위 프로젝트 '검증 시간'의 어느 칸에 더해질지 고릅니다. 재는 도중에 바꾸면 그때까지 잰 시간은 이전 칸에 들어갑니다."
                      className="mt-1 w-full rounded-lg border border-border bg-white px-2 py-1.5 text-xs text-text"
                    >
                      {TIME_TARGET_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                      <option value="">검증 시간에 기록 안 함</option>
                    </select>
                  </label>

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
                          label="완료 및 기록"
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
                          label="완료 및 기록"
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

        {completedLogs.length > 0 && (
          <div className="mt-6">
            <TimerColumn
              title="최근 완료 작업"
              emptyText=""
              items={completedLogs}
              renderItem={(log) => (
                <LogCard
                  key={log.id}
                  log={log}
                  onDelete={() => mutateLog(log.id, 'delete')}
                  busy={busy}
                  now={now}
                />
              )}
            />
          </div>
        )}

        {orphanPausedLogs.length > 0 && (
          <div className="mt-4">
            <TimerColumn
              title="일시정지 작업"
              emptyText=""
              items={orphanPausedLogs}
              renderItem={(log) => (
                <LogCard
                  key={log.id}
                  log={log}
                  onResume={() => mutateLog(log.id, 'resume')}
                  onComplete={() => mutateLog(log.id, 'complete')}
                  onDelete={() => mutateLog(log.id, 'delete')}
                  busy={busy}
                  now={now}
                />
              )}
            />
          </div>
        )}
      </section>

      <Modal
        open={pendingStart !== null}
        onClose={() => setPendingStart(null)}
        closeOnEsc
        size="sm"
        ariaLabel="동시 진행 선택"
      >
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-text">
              이미 진행 중인 작업이 있습니다
            </h2>
            <p className="mt-1 text-sm text-text-subtle">
              새 작업을 시작하려면 기존 작업을 일시정지하거나 동시 진행으로 이어갈 수 있습니다.
            </p>
          </div>

          <div className="space-y-2 rounded-xl bg-surface-muted p-3">
            {runningLogs.map((log) => (
              <p key={log.id} className="text-sm text-text">
                {log.task_name} · {formatHMS(getElapsedSeconds(log, now))}
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
              className="rounded-xl border border-verify-warn-fg/30 px-4 py-2 text-sm font-medium text-verify-warn-fg hover:bg-verify-warn-bg disabled:opacity-50"
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
              className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50"
            >
              동시 진행
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
          <MiniButton label="완료 및 기록" onClick={onComplete} disabled={busy} tone="emerald" />
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
  emerald: 'bg-verify-pass-fg text-white hover:bg-verify-pass-fg',
  amber: 'bg-verify-warn-bg text-verify-warn-fg hover:bg-verify-warn-bg',
  rose: 'bg-rose-100 text-rose-700 hover:bg-rose-200',
  slate: 'bg-surface-subtle text-text hover:bg-border-strong',
};

const STATUS_LABEL = {
  running: '진행 중',
  paused: '일시정지',
  completed: '완료',
};

const STATUS_BADGE = {
  running: 'bg-verify-pass-bg text-verify-pass-fg',
  paused: 'bg-verify-warn-bg text-verify-warn-fg',
  completed: 'bg-border-strong text-text',
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
