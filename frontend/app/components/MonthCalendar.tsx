'use client';

import type { ReactNode } from 'react';
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
  month: number;
  subprojects: SubProject[];
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onSelectDate?: (isoDate: string) => void;
  onSelectSubProject?: (sp: SubProject) => void;
  rightAction?: ReactNode;
  title?: string;
  tag?: string;
  tagColor?: string;
  filterSlot?: ReactNode;
};

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const PROJECT_BAR_COLORS = ['#2563EB', '#534AB7', '#0F6E56', '#854F0B', '#185FA5', '#993556'];

export default function MonthCalendar({
  year,
  month,
  subprojects,
  onPrevMonth,
  onNextMonth,
  onSelectDate,
  onSelectSubProject,
  rightAction,
  title = '캘린더',
  tag,
  tagColor = '#534AB7',
  filterSlot,
}: Props) {
  const days = useMemo(() => getMonthMatrix(year, month), [year, month]);
  const today = toISODate(new Date());

  return (
    <div className="overflow-hidden rounded-xl border border-[#EAEAE4] bg-white shadow-sm">
      <div className="border-b border-[#EAEAE4] px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 className="text-[13px] font-semibold text-[#1A1A1A]">{title}</h3>
            {tag && (
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                style={{
                  backgroundColor: `${tagColor}20`,
                  color: tagColor,
                }}
              >
                {tag}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onPrevMonth}
              className="text-[16px] text-[#888780]"
              aria-label="이전 달"
            >
              ‹
            </button>
            <span className="min-w-[76px] text-center text-[11px] font-semibold text-[#1A1A1A]">
              {formatMonth(year, month)}
            </span>
            <button
              type="button"
              onClick={onNextMonth}
              className="text-[16px] text-[#888780]"
              aria-label="다음 달"
            >
              ›
            </button>
            {rightAction}
          </div>
        </div>
        {filterSlot && <div className="mt-3">{filterSlot}</div>}
      </div>

      <div className="p-3">
        <div className="mb-2 grid grid-cols-7 gap-1 text-center">
          {WEEKDAYS.map((weekday) => (
            <div
              key={weekday}
              className="py-1 text-[9px] font-bold text-[#888780]"
            >
              {weekday}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {days.map((day) => {
            const iso = toISODate(day);
            const inMonth = day.getMonth() === month;
            const itemsToday = subprojects.filter((subproject) =>
              rangeOverlapsDay(
                {
                  start: parseISODate(subproject.start_date),
                  end: parseISODate(subproject.end_date),
                },
                day,
              ),
            );
            const firstItem = itemsToday[0];
            const barColor =
              PROJECT_BAR_COLORS[
                firstItem ? firstItem.project_id % PROJECT_BAR_COLORS.length : 0
              ];
            const isToday = iso === today;

            return (
              <button
                key={iso}
                type="button"
                onClick={() => onSelectDate?.(iso)}
                className={`relative aspect-square rounded-[5px] px-1 py-1 text-left align-top transition ${
                  isToday
                    ? 'bg-[#534AB7] text-white'
                    : inMonth
                      ? 'text-[#1A1A1A] hover:bg-[#F1EFE8]'
                      : 'text-[#B4B2A9] hover:bg-[#F8F8F5]'
                }`}
              >
                <div className={`relative z-10 text-[10px] ${isToday ? 'font-bold' : ''}`}>
                  {day.getDate()}
                </div>

                {firstItem && (
                  <div
                    onClick={(event) => {
                      event.stopPropagation();
                      onSelectSubProject?.(firstItem);
                    }}
                    className="absolute bottom-[3px] left-[2px] right-[2px] z-0 flex h-[14px] items-center rounded-[6px] px-[5px] text-left"
                    style={{ backgroundColor: barColor, opacity: 0.9 }}
                    title={`${firstItem.name} (${firstItem.assignee?.name ?? '미지정'})`}
                  >
                    <span className="truncate text-[8px] font-bold text-white">
                      {firstItem.name} {Math.round(firstItem.progress)}%
                    </span>
                  </div>
                )}

                {itemsToday.length > 1 && !firstItem && (
                  <span className="absolute bottom-[2px] left-1 h-1 w-1 rounded-full bg-[#534AB7]" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function shiftMonth(date: Date, delta: number): Date {
  return addMonths(date, delta);
}
