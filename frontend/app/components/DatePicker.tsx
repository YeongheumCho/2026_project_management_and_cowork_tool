'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { addMonths, formatMonth, getMonthMatrix, toISODate } from '../lib/calendar';

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  min?: string;
};

export default function DatePicker({
  value,
  onChange,
  placeholder = '날짜 선택',
  min,
}: Props) {
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(() => {
    const base = value ? new Date(`${value}T00:00:00`) : new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  useEffect(() => {
    if (!value) return;
    const next = new Date(`${value}T00:00:00`);
    setCursor(new Date(next.getFullYear(), next.getMonth(), 1));
  }, [value]);

  const days = useMemo(
    () => getMonthMatrix(cursor.getFullYear(), cursor.getMonth()),
    [cursor],
  );

  const weekdayLabels = ['일', '월', '화', '수', '목', '금', '토'];
  const selectedValue = value || '';

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={selectedValue ? `선택된 날짜: ${selectedValue}, 달력 열기` : `${placeholder}, 달력 열기`}
        className={`flex w-full items-center justify-between rounded-lg border px-2.5 py-1.5 text-small ${
          open
            ? 'border-brand bg-surface'
            : 'border-border-strong bg-surface-muted'
        }`}
      >
        <span className={selectedValue ? 'text-text' : 'text-text-faint'}>
          {selectedValue || placeholder}
        </span>
        <span className="text-body text-text-subtle" aria-hidden="true">▾</span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="날짜 선택 달력"
          className="absolute left-0 top-[calc(100%+4px)] z-[400] min-w-[240px] rounded-xl border border-border-strong bg-surface p-3.5 shadow-[0_8px_24px_rgba(0,0,0,0.12)]"
        >
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setCursor((current) => addMonths(current, -1))}
              aria-label="이전 달"
              className="rounded px-1 text-base text-text-subtle hover:bg-surface-subtle hover:text-text transition"
            >
              ‹
            </button>
            <p className="text-body font-bold text-text">
              {formatMonth(cursor.getFullYear(), cursor.getMonth())}
            </p>
            <button
              type="button"
              onClick={() => setCursor((current) => addMonths(current, 1))}
              aria-label="다음 달"
              className="rounded px-1 text-base text-text-subtle hover:bg-surface-subtle hover:text-text transition"
            >
              ›
            </button>
          </div>

          <div className="mb-2 grid grid-cols-7 gap-1 text-center">
            {weekdayLabels.map((label) => (
              <div
                key={label}
                className="py-1 text-nano font-bold text-text-subtle"
                aria-hidden="true"
              >
                {label}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1" role="grid">
            {days.map((day) => {
              const iso = toISODate(day);
              const inMonth = day.getMonth() === cursor.getMonth();
              const selected = iso === selectedValue;
              const disabled = !!min && iso < min;

              return (
                <button
                  key={iso}
                  type="button"
                  disabled={disabled}
                  aria-label={`${iso}${selected ? ', 선택됨' : ''}${disabled ? ', 선택 불가' : ''}`}
                  aria-pressed={selected}
                  onClick={() => {
                    if (disabled) return;
                    onChange(iso);
                    setOpen(false);
                  }}
                  className={`rounded-md py-1 text-center text-small transition ${
                    selected
                      ? 'bg-brand font-bold text-white'
                      : disabled
                        ? 'text-border-strong'
                        : inMonth
                          ? 'text-text hover:bg-surface-subtle'
                          : 'text-text-faint hover:bg-background'
                  }`}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
