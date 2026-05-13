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
        className={`flex w-full items-center justify-between rounded-lg border px-[10px] py-[7px] text-small ${
          open
            ? 'border-[#534AB7] bg-white'
            : 'border-[#D3D1C7] bg-[#FAFAFA]'
        }`}
      >
        <span className={selectedValue ? 'text-[#1A1A1A]' : 'text-[#B4B2A9]'}>
          {selectedValue || placeholder}
        </span>
        <span className="text-body text-[#888780]">▾</span>
      </button>

      {open && (
        <div className="absolute left-0 top-[calc(100%+4px)] z-[400] min-w-[240px] rounded-xl border border-[#D3D1C7] bg-white p-[14px] shadow-[0_8px_24px_rgba(0,0,0,0.12)]">
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setCursor((current) => addMonths(current, -1))}
              className="text-base text-[#888780]"
            >
              ‹
            </button>
            <p className="text-body font-bold text-[#1A1A1A]">
              {formatMonth(cursor.getFullYear(), cursor.getMonth())}
            </p>
            <button
              type="button"
              onClick={() => setCursor((current) => addMonths(current, 1))}
              className="text-base text-[#888780]"
            >
              ›
            </button>
          </div>

          <div className="mb-2 grid grid-cols-7 gap-1 text-center">
            {weekdayLabels.map((label) => (
              <div
                key={label}
                className="py-1 text-nano font-bold text-[#888780]"
              >
                {label}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
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
                  onClick={() => {
                    if (disabled) return;
                    onChange(iso);
                    setOpen(false);
                  }}
                  className={`rounded-md py-[5px] text-center text-small transition ${
                    selected
                      ? 'bg-[#534AB7] font-bold text-white'
                      : disabled
                        ? 'text-[#D3D1C7]'
                        : inMonth
                          ? 'text-[#1A1A1A] hover:bg-[#F1EFE8]'
                          : 'text-[#B4B2A9] hover:bg-[#F8F8F5]'
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
