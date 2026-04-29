'use client';

import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
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

  // 날짜 팝오버 상태
  const [popoverIso, setPopoverIso] = useState<string | null>(null);
  const [popoverItems, setPopoverItems] = useState<SubProject[]>([]);
  const popoverRef = useRef<HTMLDivElement>(null);

  // 팝오버 외부 클릭 시 닫기
  useEffect(() => {
    if (!popoverIso) return;
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setPopoverIso(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [popoverIso]);

  // 월이 바뀌면 팝오버 닫기
  useEffect(() => {
    setPopoverIso(null);
  }, [year, month]);

  function openDayPopover(iso: string, items: SubProject[]) {
    if (items.length === 0) {
      // 일정 없으면 일정 추가 콜백 (기존 동작 유지)
      onSelectDate?.(iso);
      return;
    }
    if (popoverIso === iso) {
      setPopoverIso(null);
      return;
    }
    setPopoverIso(iso);
    setPopoverItems(items);
  }

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

        <div className="relative grid grid-cols-7 gap-1">
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
            const isToday = iso === today;
            const isPopoverOpen = popoverIso === iso;

            // 최대 2개까지 바로 표시, 나머지는 +N 배지
            const MAX_BARS = 2;
            const visibleItems = itemsToday.slice(0, MAX_BARS);
            const hiddenCount = itemsToday.length - MAX_BARS;

            return (
              <button
                key={iso}
                type="button"
                onClick={() => openDayPopover(iso, itemsToday)}
                className={`relative flex min-h-[52px] flex-col rounded-[5px] px-1 py-1 text-left align-top transition ${
                  isPopoverOpen
                    ? 'ring-2 ring-[#534AB7] ring-offset-1'
                    : ''
                } ${
                  isToday
                    ? 'bg-[#534AB7] text-white'
                    : inMonth
                      ? 'text-[#1A1A1A] hover:bg-[#F1EFE8]'
                      : 'text-[#B4B2A9] hover:bg-[#F8F8F5]'
                }`}
              >
                <div className={`text-[10px] ${isToday ? 'font-bold' : ''}`}>
                  {day.getDate()}
                </div>

                <div className="mt-0.5 flex flex-col gap-[2px]">
                  {visibleItems.map((item) => {
                    const barColor =
                      PROJECT_BAR_COLORS[item.project_id % PROJECT_BAR_COLORS.length];
                    return (
                      <div
                        key={item.id}
                        onClick={(event) => {
                          event.stopPropagation();
                          onSelectSubProject?.(item);
                        }}
                        className="flex h-[13px] w-full items-center rounded-[4px] px-[4px] text-left"
                        style={{ backgroundColor: barColor, opacity: 0.9 }}
                        title={`${item.name} (${item.assignee?.name ?? '미지정'}) ${Math.round(item.progress)}%`}
                      >
                        <span className="truncate text-[7px] font-bold leading-none text-white">
                          {item.name}
                        </span>
                      </div>
                    );
                  })}

                  {hiddenCount > 0 && (
                    <div className="flex h-[13px] items-center px-[4px]">
                      <span
                        className={`text-[7px] font-bold leading-none ${
                          isToday ? 'text-white/80' : 'text-[#888780]'
                        }`}
                      >
                        +{hiddenCount}개 더
                      </span>
                    </div>
                  )}
                </div>
              </button>
            );
          })}

          {/* 날짜 클릭 팝오버 — 해당 날의 소프로젝트 전체 목록 */}
          {popoverIso && (
            <div
              ref={popoverRef}
              className="absolute left-1/2 z-50 w-72 -translate-x-1/2 rounded-xl border border-[#EAEAE4] bg-white shadow-lg"
              style={{ top: 'calc(100% + 6px)' }}
            >
              {/* 팝오버 헤더 */}
              <div className="flex items-center justify-between border-b border-[#F1EFE8] px-4 py-3">
                <div>
                  <p className="text-[12px] font-bold text-[#1A1A1A]">{popoverIso}</p>
                  <p className="text-[10px] text-[#888780]">
                    소프로젝트 {popoverItems.length}건
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPopoverIso(null)}
                  className="rounded-full p-1 text-[#888780] hover:bg-[#F1EFE8] hover:text-[#1A1A1A]"
                  aria-label="닫기"
                >
                  ✕
                </button>
              </div>

              {/* 소프로젝트 목록 */}
              <div className="max-h-64 overflow-y-auto p-2">
                {popoverItems.map((item) => {
                  const barColor =
                    PROJECT_BAR_COLORS[item.project_id % PROJECT_BAR_COLORS.length];
                  const statusMap: Record<string, { label: string; cls: string }> = {
                    completed: { label: '완료', cls: 'bg-[#E1F5EE] text-[#0F6E56]' },
                    in_progress: { label: '진행 중', cls: 'bg-[#E6F1FB] text-[#185FA5]' },
                    planned: { label: '예정', cls: 'bg-[#FAEEDA] text-[#854F0B]' },
                  };
                  const st = statusMap[item.status] ?? statusMap['planned'];

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setPopoverIso(null);
                        onSelectSubProject?.(item);
                      }}
                      className="flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition hover:bg-[#F8F8F5]"
                    >
                      {/* 프로젝트 컬러 도트 */}
                      <span
                        className="mt-[3px] h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: barColor }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12px] font-semibold text-[#1A1A1A]">
                          {item.name}
                        </p>
                        <p className="mt-0.5 text-[10px] text-[#888780]">
                          {item.start_date} ~ {item.end_date}
                        </p>
                        <div className="mt-1 flex items-center gap-1.5">
                          <span
                            className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${st.cls}`}
                          >
                            {st.label}
                          </span>
                          {item.assignee?.name && (
                            <span className="text-[9px] text-[#888780]">
                              {item.assignee.name}
                            </span>
                          )}
                          <span className="ml-auto text-[10px] font-semibold text-[#1A1A1A]">
                            {Math.round(item.progress)}%
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* 일정 추가 버튼 (onSelectDate 콜백이 있을 때만 표시) */}
              {onSelectDate && (
                <div className="border-t border-[#F1EFE8] px-3 py-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPopoverIso(null);
                      onSelectDate(popoverIso);
                    }}
                    className="w-full rounded-lg border border-dashed border-[#AFA9EC] py-1.5 text-[11px] font-bold text-[#534AB7] transition hover:bg-[#EEEDFE]"
                  >
                    + 이 날에 일정 추가
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function shiftMonth(date: Date, delta: number): Date {
  return addMonths(date, delta);
}
