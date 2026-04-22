'use client';

import { useEffect, useRef, useState } from 'react';
import type { SubProject } from '../../lib/api';

type Props = {
  /** 현재 선택된 프로젝트에 속한 소프로젝트 후보 */
  candidates: SubProject[];
  projectName?: string;
  helperText?: string;
};

type TimerState = 'idle' | 'running' | 'paused';

/**
 * 개요 페이지의 작업 시간 타이머 위젯 (Figma 상단 "00:00:00" 블록).
 *
 * - 현재는 로컬 상태만 관리 (서버 영속화 X). 추후 backend 에 작업 로그 API 가
 *   생기면 stop 시점에 POST 하도록 확장.
 * - 재생/일시정지/정지 3버튼 컨트롤.
 * - 드롭다운으로 대상 소프로젝트 선택.
 */
export default function TimerWidget({
  candidates,
  projectName,
  helperText,
}: Props) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [state, setState] = useState<TimerState>('idle');
  const [elapsed, setElapsed] = useState(0); // seconds
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const selected = candidates.find((c) => c.id === selectedId) ?? null;

  useEffect(() => {
    setState('idle');
    setElapsed(0);
    setSelectedId((current) => {
      if (current && candidates.some((candidate) => candidate.id === current)) {
        return current;
      }
      return candidates[0]?.id ?? null;
    });
  }, [candidates, projectName]);

  useEffect(() => {
    if (state !== 'running') return;
    intervalRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [state]);

  const start = () => {
    if (!selectedId) return;
    setState('running');
  };
  const pause = () => setState((prev) => (prev === 'running' ? 'paused' : prev));
  const stop = () => {
    setState('idle');
    setElapsed(0);
  };

  return (
    <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center gap-6">
        <p className="font-mono text-4xl font-bold tabular-nums tracking-tight text-slate-900">
          {formatHMS(elapsed)}
        </p>

        <div className="flex-1 min-w-[200px]">
          <p className="text-lg font-semibold text-slate-900">
            {projectName ?? '선택된 프로젝트 없음'}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {helperText ?? '프로젝트를 선택하고 시작하세요'}
          </p>
          <select
            value={selectedId ?? ''}
            onChange={(e) =>
              setSelectedId(e.target.value ? Number(e.target.value) : null)
            }
            disabled={state === 'running'}
            className="mt-3 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm disabled:bg-slate-50"
          >
            <option value="">프로젝트를 선택하고 시작하세요</option>
            {candidates.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {selected && (
            <p className="mt-1 text-xs text-slate-500">
              {selected.start_date} ~ {selected.end_date}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <ControlButton
            tone="emerald"
            title="시작"
            disabled={!selectedId || state === 'running'}
            onClick={start}
          >
            ▶
          </ControlButton>
          <ControlButton
            tone="amber"
            title="일시정지"
            disabled={state !== 'running'}
            onClick={pause}
          >
            ❙❙
          </ControlButton>
          <ControlButton
            tone="rose"
            title="정지"
            disabled={state === 'idle' && elapsed === 0}
            onClick={stop}
          >
            ■
          </ControlButton>
        </div>
      </div>
    </section>
  );
}

type ToneKey = 'emerald' | 'amber' | 'rose';
const TONE: Record<ToneKey, string> = {
  emerald:
    'border-emerald-200 text-emerald-700 hover:bg-emerald-50 disabled:opacity-40',
  amber: 'border-amber-200 text-amber-700 hover:bg-amber-50 disabled:opacity-40',
  rose: 'border-rose-200 text-rose-700 hover:bg-rose-50 disabled:opacity-40',
};

function ControlButton({
  tone,
  title,
  disabled,
  onClick,
  children,
}: {
  tone: ToneKey;
  title: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`flex h-10 w-10 items-center justify-center rounded-full border bg-white text-sm transition disabled:cursor-not-allowed ${TONE[tone]}`}
    >
      {children}
    </button>
  );
}

function formatHMS(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}
