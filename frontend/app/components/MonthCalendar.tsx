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
import {
  isSubprojectOverdue,
  subprojectBadgeClass,
  subprojectStatusLabel,
} from '../lib/subprojectStatus';

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

// A-26: Atlassian 캘린더 템플릿 참고 — 연한 배경 + 같은 계열의 진한 글자색.
// 전체 캘린더(A)와 담당자 캘린더(B) 모두 project_id 기준으로 색을 정해 같은 프로젝트가 같은 색으로 보이고,
// 완료(초록)·기한 초과(빨강)는 프로젝트 색보다 우선한다.
type BarTone = { bg: string; fg: string };
const PROJECT_TONES: BarTone[] = [
  { bg: '#E9F2FF', fg: '#0C66E4' }, // blue
  { bg: '#F3F0FF', fg: '#5E4DB2' }, // purple
  { bg: '#E7F9FF', fg: '#206A83' }, // teal
  { bg: '#FFF7D6', fg: '#7F5F01' }, // yellow
  { bg: '#FFECF8', fg: '#943D73' }, // magenta
  { bg: '#EFFFD6', fg: '#4C6B1F' }, // lime
];
const TONE_DONE: BarTone = { bg: '#DCFFF1', fg: '#216E4E' };
const TONE_OVERDUE: BarTone = { bg: '#FFECEB', fg: '#AE2E24' };

// 기한 초과 판정은 lib/subprojectStatus 에 모아 두고 사이드바·목록과 같은 규칙을 쓴다
function barTone(sp: SubProject, today: string): BarTone {
  if (sp.status === 'completed') return TONE_DONE;
  if (isSubprojectOverdue(sp, today)) return TONE_OVERDUE;
  return PROJECT_TONES[Math.abs(sp.project_id) % PROJECT_TONES.length];
}

// 막대 오른쪽 끝 표식 — 템플릿의 완료 체크/지연 아이콘 자리
function barMark(sp: SubProject, today: string): string | null {
  if (sp.status === 'completed') return '✓';
  if (isSubprojectOverdue(sp, today)) return '!';
  return null;
}

function BarLabel({ sp, today }: { sp: SubProject; today: string }) {
  const mark = barMark(sp, today);
  return (
    <>
      <span className="min-w-0 flex-1 truncate text-[10px] font-semibold leading-none">
        {sp.name} {Math.round(sp.progress)}%
      </span>
      {mark && <span className="ml-1 shrink-0 text-[10px] font-bold leading-none">{mark}</span>}
    </>
  );
}

function assigneeNames(item: SubProject): string {
  const names = item.assignees?.map((assignee) => assignee.name).filter(Boolean);
  if (names?.length) return names.join(', ');
  return item.assignee?.name ?? '미지정';
}

// A-26: 막대·글씨를 한 단계 키움 (13px → 16px)
const BAR_H = 16;
const BAR_GAP = 2;
const DATE_AREA_H = 20;
const FIXED_TRACK_COUNT = 4;
// 트랙을 넘친 일정은 "+N개 더" 한 줄로 표시 (템플릿의 "+15 more")
const MORE_AREA_H = 14;
const FIXED_ROW_HEIGHT = DATE_AREA_H + FIXED_TRACK_COUNT * (BAR_H + BAR_GAP) + MORE_AREA_H + 2;
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
  tagColor = '#0048FF',
  filterSlot,
  continuousBars = false,
}: Props) {
  const days = useMemo(() => getMonthMatrix(year, month), [year, month]);
  const today = toISODate(new Date());

  // 이 달에 걸치는 일정이 하나도 없는지. 빈 격자만 보이면 고장난 것처럼 읽힌다.
  const monthHasItems = useMemo(() => {
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    return subprojects.some((sp) => {
      const start = parseISODate(sp.start_date);
      const end = parseISODate(sp.end_date);
      return !(end < first || start > last);
    });
  }, [subprojects, year, month]);

  // 가장 가까운 일정이 있는 달 — 빈 달에서 바로 이동할 수 있게 한다.
  const nearestMonth = useMemo(() => {
    if (monthHasItems || subprojects.length === 0) return null;
    const cursorIndex = year * 12 + month;
    let best: { distance: number; year: number; month: number } | null = null;
    for (const sp of subprojects) {
      for (const iso of [sp.start_date, sp.end_date]) {
        const date = parseISODate(iso);
        const index = date.getFullYear() * 12 + date.getMonth();
        const distance = Math.abs(index - cursorIndex);
        if (!best || distance < best.distance) {
          best = { distance, year: date.getFullYear(), month: date.getMonth() };
        }
      }
    }
    return best;
  }, [subprojects, year, month, monthHasItems]);

  const [popoverIso, setPopoverIso] = useState<string | null>(null);
  const [popoverItems, setPopoverItems] = useState<SubProject[]>([]);
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number; openUp: boolean }>({ top: 0, left: 0, openUp: false });
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(year);
  // A-26: 일정 막대에 마우스를 올리면 아래에 상세 툴팁을 띄운다 (뷰포트 기준 fixed)
  const [hoverTip, setHoverTip] = useState<{ sp: SubProject; top: number; left: number } | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const monthPickerRef = useRef<HTMLDivElement>(null);

  function showHoverTip(sp: SubProject, target: HTMLElement) {
    const rect = target.getBoundingClientRect();
    const tipW = 260;
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - tipW - 8));
    setHoverTip({ sp, top: rect.bottom + 6, left });
  }
  const hideHoverTip = () => setHoverTip(null);

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

  useEffect(() => { setPopoverIso(null); setHoverTip(null); }, [year, month]);
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
            <div key={w} className="py-1 text-tiny font-bold text-text-subtle">{w}</div>
          ))}
        </div>

        {continuousBars ? (
          <div className="space-y-[2px]">
            {[0, 1, 2, 3, 4, 5].map((wr) => {
              const weekDays = days.slice(wr * 7, wr * 7 + 7);
              const segsThisRow = barSegments.filter((s) => s.weekRow === wr && s.track < FIXED_TRACK_COUNT);
              // 트랙 초과분은 요일별로 세어 "+N개 더"로 표시
              const hiddenByCol = Array<number>(7).fill(0);
              for (const seg of barSegments) {
                if (seg.weekRow !== wr || seg.track < FIXED_TRACK_COUNT) continue;
                for (let col = seg.colStart; col <= seg.colEnd; col++) hiddenByCol[col]++;
              }
              return (
                <div key={wr} className="relative grid grid-cols-7 gap-[2px] overflow-hidden" style={{ height: uniformRowHeight }}>
                  {weekDays.map((day, col) => {
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
                        <span className={`text-micro ${isToday ? 'inline-flex h-[20px] w-[20px] items-center justify-center rounded-full bg-brand font-bold text-white' : ''}`}>{day.getDate()}</span>
                        {hiddenByCol[col] > 0 && (
                          <span className="absolute bottom-[2px] left-[5px] text-[10px] font-semibold leading-none text-text-subtle">
                            +{hiddenByCol[col]}개 더
                          </span>
                        )}
                      </button>
                    );
                  })}

                  {segsThisRow.map((seg, idx) => {
                    const tone = barTone(seg.sp, today);
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
                        onMouseEnter={(e) => showHoverTip(seg.sp, e.currentTarget)}
                        onMouseLeave={hideHoverTip}
                        aria-label={`${seg.sp.name} (${assigneeNames(seg.sp)}) ${Math.round(seg.sp.progress)}%`}
                        className="absolute flex items-center overflow-hidden px-[6px] text-left transition hover:brightness-95"
                        style={{ top, left, width, height: BAR_H, backgroundColor: tone.bg, color: tone.fg, borderRadius: br }}
                      >
                        {/* A-26: 주가 바뀌어도 매 주차 막대마다 이름·진행률을 다시 표기 */}
                        <BarLabel sp={seg.sp} today={today} />
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
                  <div className={`text-micro ${isToday ? 'inline-flex h-[20px] w-[20px] items-center justify-center self-start rounded-full bg-brand font-bold text-white' : ''}`}>{day.getDate()}</div>
                  <div className="mt-0.5 flex flex-col gap-[2px]">
                    {visibleItems.map((item) => {
                      const tone = barTone(item, today);
                      return (
                        <div
                          key={item.id}
                          onClick={(e) => { e.stopPropagation(); onSelectSubProject?.(item); }}
                          onMouseEnter={(e) => showHoverTip(item, e.currentTarget)}
                          onMouseLeave={hideHoverTip}
                          className="flex h-[16px] w-full items-center rounded-[4px] px-[5px] text-left transition hover:brightness-95"
                          style={{ backgroundColor: tone.bg, color: tone.fg }}
                          aria-label={`${item.name} (${assigneeNames(item)}) ${Math.round(item.progress)}%`}
                        >
                          <BarLabel sp={item} today={today} />
                        </div>
                      );
                    })}
                    {hiddenCount > 0 && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); openDayPopover(iso, itemsToday, e.currentTarget); }}
                        className={`flex h-[16px] items-center rounded-[3px] px-[4px] transition hover:bg-surface-subtle`}
                      >
                        <span className={`text-[9px] font-bold leading-none text-brand`}>
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

        {/* 빈 달 안내 — 일정이 없어서 빈 격자만 보이는 상황을 설명한다 */}
        {!monthHasItems && (
          <div className="mt-3 rounded-xl border border-dashed border-border-strong bg-surface-muted px-4 py-3 text-center">
            <p className="text-small text-text-muted">
              {subprojects.length === 0
                ? '표시할 일정이 없습니다.'
                : `${formatMonth(year, month)}에는 일정이 없습니다.`}
            </p>
            {nearestMonth && onSelectMonth && (
              <button
                type="button"
                onClick={() => onSelectMonth(nearestMonth.year, nearestMonth.month)}
                className="mt-2 rounded-lg border border-brand-soft bg-white px-3 py-1.5 text-micro font-bold text-brand transition hover:bg-brand-soft"
              >
                가장 가까운 일정 보기 ({formatMonth(nearestMonth.year, nearestMonth.month)})
              </button>
            )}
          </div>
        )}
      </div>

      {/* A-26: 일정 막대 hover 툴팁 — 클릭 없이 상세 확인 */}
      {hoverTip && !popoverIso && (
        <div
          role="tooltip"
          className="pointer-events-none fixed z-[9998] w-[260px] rounded-xl border border-border bg-surface p-3 shadow-xl"
          style={{ top: hoverTip.top, left: hoverTip.left }}
        >
          <div className="flex items-start gap-2">
            <span
              className="mt-[5px] h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: barTone(hoverTip.sp, today).fg }}
            />
            <div className="min-w-0 flex-1">
              <p className="text-small font-bold text-text">{hoverTip.sp.name}</p>
              <p className="mt-0.5 text-tiny text-text-subtle">
                {hoverTip.sp.start_date} ~ {hoverTip.sp.end_date}
              </p>
              <p className="mt-1 text-tiny text-text-muted">담당: {assigneeNames(hoverTip.sp)}</p>
              <div className="mt-1.5 flex items-center gap-1.5">
                <span className={`rounded-full px-1.5 py-0.5 text-nano font-bold ${subprojectBadgeClass(hoverTip.sp, today)}`}>
                  {subprojectStatusLabel(hoverTip.sp, today)}
                </span>
                <span className="ml-auto text-tiny font-semibold text-text">
                  진행률 {Math.round(hoverTip.sp.progress)}%
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

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
        const todayIso = toISODate(new Date());
        const barColor = barTone(item, todayIso).fg;
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
              <p className="mt-0.5 text-micro text-text-subtle">{item.start_date} ~ {item.end_date}</p>
              <div className="mt-1 flex items-center gap-1.5">
                <span className={`rounded-full px-1.5 py-0.5 text-tiny font-bold ${subprojectBadgeClass(item, todayIso)}`}>
                  {subprojectStatusLabel(item, todayIso)}
                </span>
                <span className="text-tiny text-text-subtle">{assigneeNames(item)}</span>
                <span className="ml-auto text-micro font-semibold text-text">{Math.round(item.progress)}%</span>
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
