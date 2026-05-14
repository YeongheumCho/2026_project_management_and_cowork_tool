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
  onSelectMonth?: (year: number, month: number) => void;
  onSelectDate?: (isoDate: string) => void;
  onSelectSubProject?: (sp: SubProject) => void;
  rightAction?: ReactNode;
  title?: string;
  tag?: string;
  tagColor?: string;
  filterSlot?: ReactNode;
  continuousBars?: boolean;
};

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

// project_id를 같은 팔레트로 매핑 — colors.ts의 COLOR_PALETTE hex 값과 동일한 순서 유지
// 전체 캘린더(A)와 담당자 캘린더(B) 모두 project_id 기준으로 색을 결정해 일관성 보장
const PROJECT_BAR_COLORS = ['#2563EB', '#534AB7', '#0F6E56', '#854F0B', '#185FA5', '#993556'];
function projectColor(projectId: number): string {
  return PROJECT_BAR_COLORS[Math.abs(projectId) % PROJECT_BAR_COLORS.length];
}

function assigneeNames(item: SubProject): string {
  const names = item.assignees?.map((assignee) => assignee.name).filter(Boolean);
  if (names?.length) return names.join(', ');
  return item.assignee?.name ?? '미지정';
}

const BAR_H = 13;
const BAR_GAP = 2;
const DATE_AREA_H = 18;
const FIXED_TRACK_COUNT = 4;
const FIXED_ROW_HEIGHT = DATE_AREA_H + FIXED_TRACK_COUNT * (BAR_H + BAR_GAP) + 4;
const MONTH_LABELS = Array.from({ length: 12 }, (_, index) => `${index + 1}월`);

export default function MonthCalendar({
  year,
  month,
  subprojects,
  onPrevMonth,
  onNextMonth,
  onSelectMonth,
  onSelectDate,
  onSelectSubProject,
  rightAction,
  title = '캘린더',
  tag,
  tagColor = '#534AB7',
  filterSlot,
  continuousBars = false,
}: Props) {
  const days = useMemo(() => getMonthMatrix(year, month), [year, month]);
  const today = toISODate(new Date());

  const [popoverIso, setPopoverIso] = useState<string | null>(null);
  const [popoverItems, setPopoverItems] = useState<SubProject[]>([]);
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number; openUp: boolean }>({ top: 0, left: 0, openUp: false });
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(year);
  const popoverRef = useRef<HTMLDivElement>(null);
  const monthPickerRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => { setPopoverIso(null); }, [year, month]);
  useEffect(() => { setMonthPickerOpen(false); setPickerYear(year); }, [year, month]);

  useEffect(() => {
    if (!monthPickerOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (monthPickerRef.current && !monthPickerRef.current.contains(e.target as Node)) {
        setMonthPickerOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [monthPickerOpen]);

  // continuousBars 모드에서는 DayPopover의 "일정 추가" 버튼을 숨김
  // (전체 프로젝트 캘린더에서는 헤더의 "+ 일정 추가" 버튼으로만 생성)
  const popoverSelectDate = continuousBars ? undefined : onSelectDate;

  function openDayPopover(iso: string, items: SubProject[], triggerEl?: HTMLElement) {
    // items가 없고 팝오버에 일정 추가 버튼도 없으면 바로 onSelectDate 호출
    if (items.length === 0 && !popoverSelectDate) { onSelectDate?.(iso); return; }
    if (popoverIso === iso) { setPopoverIso(null); return; }

    // 팝오버 위치 계산 (fixed 기준 — scrollY 더하면 안 됨)
    // 셀 바로 아래로 열고, 공간 부족 시만 위로 열림
    if (triggerEl) {
      const rect = triggerEl.getBoundingClientRect();
      const popoverH = 320;
      const popoverW = 288; // w-72
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUp = spaceBelow < popoverH + 16 && rect.top > popoverH + 16;
      const rawLeft = rect.left + rect.width / 2 - popoverW / 2;
      const clampedLeft = Math.max(8, Math.min(rawLeft, window.innerWidth - popoverW - 8));
      setPopoverPos({
        top: openUp ? rect.top - popoverH - 6 : rect.bottom + 6,
        left: clampedLeft,
        openUp,
      });
    }
    setPopoverIso(iso);
    setPopoverItems(items);
  }

  type BarSegment = {
    sp: SubProject;
    track: number;
    colStart: number;
    colEnd: number;
    weekRow: number;
    isStart: boolean;
    isEnd: boolean;
  };

  const barSegments = useMemo<BarSegment[]>(() => {
    if (!continuousBars) return [];
    const WEEKS = 6;
    const trackEndCol: number[][] = Array.from({ length: WEEKS }, () => []);
    const result: BarSegment[] = [];
    const sorted = [...subprojects].sort((a, b) => a.start_date.localeCompare(b.start_date));
    for (const sp of sorted) {
      const spStart = parseISODate(sp.start_date);
      const spEnd = parseISODate(sp.end_date);
      for (let wr = 0; wr < WEEKS; wr++) {
        const weekStartIdx = wr * 7;
        const weekStart = days[weekStartIdx];
        const weekEnd = days[weekStartIdx + 6];
        if (spEnd < weekStart || spStart > weekEnd) continue;
        const clampedStart = spStart < weekStart ? weekStart : spStart;
        const clampedEnd = spEnd > weekEnd ? weekEnd : spEnd;
        const colStart = clampedStart.getDay();
        const colEnd = clampedEnd.getDay();
        let track = 0;
        while (trackEndCol[wr][track] !== undefined && trackEndCol[wr][track] >= colStart) {
          track++;
        }
        trackEndCol[wr][track] = colEnd;
        result.push({ sp, track, colStart, colEnd, weekRow: wr, isStart: spStart >= weekStart, isEnd: spEnd <= weekEnd });
      }
    }
    return result;
  }, [continuousBars, subprojects, days]);

  // 전체 최대 트랙 수로 모든 행의 높이를 통일 — 달력 칸 크기를 일정하게 유지
  // cell 모드: MAX_BARS(2) + hiddenCount 버튼 행 포함해 3행분 확보 → 52px
  const uniformRowHeight = FIXED_ROW_HEIGHT;

  function selectMonth(nextMonth: number) {
    onSelectMonth?.(pickerYear, nextMonth);
    setMonthPickerOpen(false);
  }

  return (
    <div className="relative rounded-xl border border-border bg-surface shadow-sm">
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 className="text-body font-semibold text-text">{title}</h3>
            {tag && (
              <span
                className="rounded-full px-2 py-0.5 text-tiny font-bold"
                style={{ backgroundColor: `${tagColor}20`, color: tagColor }}
              >
                {tag}
              </span>
            )}
          </div>
          <div className="relative flex items-center gap-3" ref={monthPickerRef}>
            <button type="button" onClick={onPrevMonth} className="text-base text-text-subtle" aria-label="이전 달">
              {'‹'}
            </button>
            <button
              type="button"
              onClick={() => {
                setPickerYear(year);
                setMonthPickerOpen((current) => !current);
              }}
              className="min-w-[86px] rounded-lg px-2 py-1 text-center text-micro font-semibold text-text transition hover:bg-surface-subtle"
            >
              {formatMonth(year, month)}
            </button>
            <button type="button" onClick={onNextMonth} className="text-base text-text-subtle" aria-label="다음 달">
              {'›'}
            </button>
            {rightAction}
            {monthPickerOpen && (
              <div className="absolute right-0 top-9 z-50 w-64 rounded-xl border border-border bg-surface p-3 shadow-xl">
                <div className="mb-3 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setPickerYear((current) => current - 1)}
                    className="rounded-lg px-2 py-1 text-sm font-bold text-text-subtle hover:bg-surface-subtle"
                    aria-label="이전 연도"
                  >
                    {'<'}
                  </button>
                  <span className="text-sm font-bold text-text">{pickerYear}년</span>
                  <button
                    type="button"
                    onClick={() => setPickerYear((current) => current + 1)}
                    className="rounded-lg px-2 py-1 text-sm font-bold text-text-subtle hover:bg-surface-subtle"
                    aria-label="다음 연도"
                  >
                    {'>'}
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {MONTH_LABELS.map((label, index) => {
                    const active = pickerYear === year && index === month;
                    return (
                      <button
                        key={label}
                        type="button"
                        onClick={() => selectMonth(index)}
                        className={[
                          'rounded-lg px-2 py-2 text-sm font-semibold transition',
                          active
                            ? 'bg-brand text-white'
                            : 'text-text hover:bg-surface-subtle',
                        ].join(' ')}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
        {filterSlot && <div className="mt-3">{filterSlot}</div>}
      </div>

      <div className="p-3">
        <div className="mb-1 grid grid-cols-7 gap-1 text-center">
          {WEEKDAYS.map((w) => (
            <div key={w} className="py-1 text-nano font-bold text-text-subtle">{w}</div>
          ))}
        </div>

        {continuousBars ? (
          <div className="space-y-[2px]">
            {[0, 1, 2, 3, 4, 5].map((wr) => {
              const weekDays = days.slice(wr * 7, wr * 7 + 7);
              const segsThisRow = barSegments.filter((s) => s.weekRow === wr && s.track < FIXED_TRACK_COUNT);
              return (
                <div key={wr} className="relative grid grid-cols-7 gap-[2px] overflow-hidden" style={{ height: uniformRowHeight }}>
                  {weekDays.map((day) => {
                    const iso = toISODate(day);
                    const inMonth = day.getMonth() === month;
                    const isToday = iso === today;
                    const itemsToday = subprojects.filter((sp) =>
                      rangeOverlapsDay({ start: parseISODate(sp.start_date), end: parseISODate(sp.end_date) }, day),
                    );
                    const isPopoverOpen = popoverIso === iso;
                    return (
                      <button
                        key={iso}
                        type="button"
                        onClick={(e) => openDayPopover(iso, itemsToday, e.currentTarget)}
                        style={{ height: uniformRowHeight }}
                        className={[
                          'relative flex flex-col rounded-[5px] px-1 pt-1 text-left transition',
                          isPopoverOpen ? 'ring-2 ring-brand ring-offset-1' : '',
                          isToday ? 'bg-brand-soft text-text' : inMonth ? 'text-text hover:bg-surface-subtle' : 'text-text-faint hover:bg-background',
                        ].join(' ')}
                      >
                        <span className={`text-tiny ${isToday ? 'inline-flex h-[18px] w-[18px] items-center justify-center rounded-full bg-brand font-bold text-white' : ''}`}>{day.getDate()}</span>
                      </button>
                    );
                  })}

                  {segsThisRow.map((seg, idx) => {
                    const color = projectColor(seg.sp.project_id);
                    const top = DATE_AREA_H + seg.track * (BAR_H + BAR_GAP);
                    const colW = `calc((100% - ${6 * 2}px) / 7)`;
                    const left = `calc(${seg.colStart} * (${colW} + 2px))`;
                    const width = `calc(${seg.colEnd - seg.colStart + 1} * (${colW} + 2px) - 2px)`;
                    const br = seg.isStart && seg.isEnd ? 6 : seg.isStart ? '6px 0 0 6px' : seg.isEnd ? '0 6px 6px 0' : 0;
                    return (
                      <button
                        key={`${seg.sp.id}-${seg.weekRow}-${idx}`}
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onSelectSubProject?.(seg.sp); }}
                        title={`${seg.sp.name} (${assigneeNames(seg.sp)}) ${Math.round(seg.sp.progress)}%`}
                        className="absolute flex items-center overflow-hidden px-[5px] text-left"
                        style={{ top, left, width, height: BAR_H, backgroundColor: color, opacity: 0.92, borderRadius: br }}
                      >
                        {seg.isStart && (
                          <span className="truncate text-[7px] font-bold leading-none text-white">
                            {seg.sp.name} {Math.round(seg.sp.progress)}%
                          </span>
                        )}
                      </button>
                    );
                  })}

                  {/* 팝오버는 아래 fixed 레이어에서 단일 렌더링 */}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="relative grid grid-cols-7 gap-1">
            {days.map((day) => {
              const iso = toISODate(day);
              const inMonth = day.getMonth() === month;
              const itemsToday = subprojects.filter((sp) =>
                rangeOverlapsDay({ start: parseISODate(sp.start_date), end: parseISODate(sp.end_date) }, day),
              );
              const isToday = iso === today;
              const isPopoverOpen = popoverIso === iso;
              const MAX_BARS = 2;
              const visibleItems = itemsToday.slice(0, MAX_BARS);
              const hiddenCount = itemsToday.length - MAX_BARS;
              return (
                <button
                  key={iso}
                  type="button"
                  onClick={(e) => openDayPopover(iso, itemsToday, e.currentTarget)}
                  style={{ height: uniformRowHeight }}
                  className={[
                    'relative flex flex-col rounded-[5px] px-1 py-1 text-left align-top transition',
                    isPopoverOpen ? 'ring-2 ring-brand ring-offset-1' : '',
                    isToday ? 'bg-brand-soft text-text' : inMonth ? 'text-text hover:bg-surface-subtle' : 'text-text-faint hover:bg-background',
                  ].join(' ')}
                >
                  <div className={`text-tiny ${isToday ? 'inline-flex h-[18px] w-[18px] items-center justify-center self-start rounded-full bg-brand font-bold text-white' : ''}`}>{day.getDate()}</div>
                  <div className="mt-0.5 flex flex-col gap-[2px]">
                    {visibleItems.map((item) => {
                      const barColor = projectColor(item.project_id);
                      return (
                        <div
                          key={item.id}
                          onClick={(e) => { e.stopPropagation(); onSelectSubProject?.(item); }}
                          className="flex h-[13px] w-full items-center rounded-[4px] px-[4px] text-left"
                          style={{ backgroundColor: barColor, opacity: 0.9 }}
                          title={`${item.name} (${assigneeNames(item)}) ${Math.round(item.progress)}%`}
                        >
                          <span className="truncate text-[7px] font-bold leading-none text-white">{item.name}</span>
                        </div>
                      );
                    })}
                    {hiddenCount > 0 && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); openDayPopover(iso, itemsToday, e.currentTarget); }}
                        className={`flex h-[13px] items-center rounded-[3px] px-[4px] transition hover:bg-surface-subtle`}
                      >
                        <span className={`text-[7px] font-bold leading-none text-brand`}>
                          +{hiddenCount}{'개 더'}
                        </span>
                      </button>
                    )}
                  </div>
                </button>
              );
            })}

            {/* 팝오버는 아래 fixed 레이어에서 단일 렌더링 */}
          </div>
        )}
      </div>

      {/* fixed 팝오버 — 뷰포트 기준 배치, 어느 행에서 열어도 UI에 가리지 않음 */}
      {popoverIso && (
        <DayPopover
          ref={popoverRef}
          iso={popoverIso}
          items={popoverItems}
          pos={popoverPos}
          onClose={() => setPopoverIso(null)}
          onSelectSubProject={(sp) => { setPopoverIso(null); onSelectSubProject?.(sp); }}
          onSelectDate={popoverSelectDate ? (d) => { setPopoverIso(null); popoverSelectDate(d); } : undefined}
        />
      )}
    </div>
  );
}

import { forwardRef } from 'react';

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  completed:   { label: '완료',   cls: 'bg-verify-pass-bg text-verify-pass-fg' },
  in_progress: { label: '진행 중', cls: 'bg-verify-info-bg text-verify-info-fg' },
  planned:     { label: '예정',   cls: 'bg-verify-warn-bg text-verify-warn-fg' },
};

const DayPopover = forwardRef<
  HTMLDivElement,
  {
    iso: string;
    items: SubProject[];
    pos: { top: number; left: number; openUp: boolean };
    onClose: () => void;
    onSelectSubProject: (sp: SubProject) => void;
    onSelectDate?: (iso: string) => void;
  }
>(({ iso, items, pos, onClose, onSelectSubProject, onSelectDate }, ref) => (
  <div
    ref={ref}
    className="fixed z-[9999] w-72 rounded-xl border border-border bg-surface shadow-xl"
    style={{ top: pos.top, left: pos.left }}
  >
    <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
      <div>
        <p className="text-small font-bold text-text">{iso}</p>
        <p className="text-tiny text-text-subtle">{'소프로젝트'} {items.length}{'건'}</p>
      </div>
      <button type="button" onClick={onClose} className="rounded-full p-1 text-text-subtle hover:bg-surface-subtle hover:text-text" aria-label="닫기">
        {'✕'}
      </button>
    </div>
    <div className="max-h-64 overflow-y-auto p-2">
      {items.map((item) => {
        const barColor = projectColor(item.project_id);
        const st = STATUS_MAP[item.status] ?? STATUS_MAP['planned'];
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelectSubProject(item)}
            className="flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition hover:bg-background"
          >
            <span className="mt-[3px] h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: barColor }} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-small font-semibold text-text">{item.name}</p>
              <p className="mt-0.5 text-tiny text-text-subtle">{item.start_date} ~ {item.end_date}</p>
              <div className="mt-1 flex items-center gap-1.5">
                <span className={`rounded-full px-1.5 py-0.5 text-nano font-bold ${st.cls}`}>{st.label}</span>
                <span className="text-nano text-text-subtle">{assigneeNames(item)}</span>
                <span className="ml-auto text-tiny font-semibold text-text">{Math.round(item.progress)}%</span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
    {onSelectDate && (
      <div className="border-t border-border-subtle px-3 py-2">
        <button
          type="button"
          onClick={() => onSelectDate(iso)}
          className="w-full rounded-lg border border-dashed border-brand/50 py-1.5 text-micro font-bold text-brand transition hover:bg-brand-soft"
        >
          {'+ 이 날에 일정 추가'}
        </button>
      </div>
    )}
  </div>
));
DayPopover.displayName = 'DayPopover';

export function shiftMonth(date: Date, delta: number): Date {
  return addMonths(date, delta);
}
