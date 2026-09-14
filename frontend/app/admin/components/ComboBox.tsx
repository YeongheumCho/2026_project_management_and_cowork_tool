'use client';

import { useEffect, useRef, useState } from 'react';

type Props = {
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  placeholder: string;
  disabled?: boolean;
};

export default function ComboBox({
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [inputVal, setInputVal] = useState(value);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInputVal(value);
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputVal(e.target.value);
    onChange(e.target.value);
    setOpen(true);
  };

  const handleSelect = (opt: string) => {
    setInputVal(opt);
    onChange(opt);
    setOpen(false);
  };

  const filtered = options.filter((opt) =>
    opt.toLowerCase().includes(inputVal.toLowerCase()),
  );

  return (
    <div ref={wrapperRef} className="relative">
      <input
        value={inputVal}
        onChange={handleInputChange}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onClick={(e) => e.stopPropagation()}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full rounded-lg border border-border bg-white px-3 py-2 text-small focus:border-brand focus:outline-none disabled:bg-surface-muted disabled:text-text-subtle"
      />
      {open && !disabled && filtered.length > 0 && (
        <ul className="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-border bg-white shadow-lg">
          {filtered.map((opt) => (
            <li
              key={opt}
              onMouseDown={() => handleSelect(opt)}
              className={`cursor-pointer px-3 py-2 text-small hover:bg-brand-soft hover:text-brand ${
                opt === inputVal ? 'bg-brand-soft font-semibold text-brand' : 'text-text'
              }`}
            >
              {opt}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
