'use client';

import { useMemo } from 'react';
import {
  addMonths,
  formatMonth,
  getMonthMatrix,
  parseISODate,
  rangeOverlapsDay,
  toISODate,
} from '../lib/calendar';
import type { SubProject } from '../lib/api';

type Props = {
  year: number;
  month: number; // 0-indexed
  subprojects: SubProject[];
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onSelectDate?: (isoDate: string) => void;
  onSelectSubProject?: (sp: SubProject) => void;
  /** 우상단 액션 버튼 (예: + 소프로젝트 추가). 관리자만 노출 */
  rightAction?: React.ReactNode;
};

const STATUS_BG: Record<SubProject['status'], string> = {
  planned: 'bg-slate-300 text-slate-800',
  in_progress: 'bg-blue-500 text-white',
  completed: 'bg-emerald-500 text-white',
};

export default function MonthCalendar({
  year,
  month,
  subprojects,
  onPrevMonth,
  onNextMonth,
  onSelectDate,
  onSelectSubProject,
  rightAction,
}: Props) {
  const days = useMemo(() => getMonthMatrix(year, month), [year, month]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 p-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onPrevMonth}
            className="rounded-lg border border-slate-200 px-3 py-1 text-sm hover:bg-slate-50"
            aria-label="이전 달"
          >
            ‹
          </button>
          <h3 className="text-lg font-semibold">{formatMonth(year, month)}</h3>
          <button
            onClick={onNextMonth}
            className="rounded-lg border border-slate-200 px-3 py-1 text-sm hover:bg-slate-50"
            aria-label="다음 달"
          >
            ›
          </button>
        </div>
        {rightAction}
      </div>

      <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50 text-center text-xs font-medium text-slate-500">
        {['일', '월', '화', '수', '목', '금', '토'].map((d) => (
          <div key={d} className="py-2">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {days.map((day, idx) => {
          const inMonth = day.getMonth() === month;
          const iso = toISODate(day);
          const itemsToday = subprojects.filter((sp) =>
            rangeOverlapsDay(
              { start: parseISODate(sp.start_date), end: parseISODate(sp.end_date) },
              day,
            ),
          );

          return (
            <button
              key={idx}
              type="button"
              onClick={() => onSelectDate?.(iso)}
              className={`h-28 border-b border-r border-slate-100 p-2 text-left align-top ${
                inMonth ? 'bg-white' : 'bg-slate-50/60 text-slate-300'
              } hover:bg-blue-50/40`}
            >
              <div className="text-xs font-semibold">{day.getDate()}</div>
              <div className="mt-1 space-y-1">
                {itemsToday.slice(0, 3).map((sp) => (
                  <div
                    key={sp.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectSubProject?.(sp);
                    }}
                    className={`truncate rounded px-1.5 py-0.5 text-[11px] ${STATUS_BG[sp.status]}`}
                    title={`${sp.name} (${sp.assignee?.name ?? '미지정'})`}
                  >
                    {sp.name}
                  </div>
                ))}
                {itemsToday.length > 3 && (
                  <div className="text-[10px] text-slate-400">
                    +{itemsToday.length - 3}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function shiftMonth(date: Date, delta: number): Date {
  return addMonths(date, delta);
}
