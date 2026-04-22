'use client';

import { type ReactNode, useEffect } from 'react';

type Size = 'sm' | 'md' | 'lg' | 'xl';

const SIZE_CLASS: Record<Size, string> = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-3xl',
};

type Props = {
  open: boolean;
  onClose: () => void;
  size?: Size;
  closeOnBackdrop?: boolean;
  closeOnEsc?: boolean;
  scrollable?: boolean;
  ariaLabel?: string;
  children: ReactNode;
};

export default function Modal({
  open,
  onClose,
  size = 'md',
  closeOnBackdrop = true,
  closeOnEsc = true,
  scrollable = false,
  ariaLabel,
  children,
}: Props) {
  useEffect(() => {
    if (!open || !closeOnEsc) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, closeOnEsc, onClose]);

  if (!open) return null;

  const containerCls = [
    'relative w-full rounded-2xl border border-[#D3D1C7] bg-white p-6 shadow-[0_8px_32px_rgba(0,0,0,0.12)]',
    SIZE_CLASS[size],
    scrollable ? 'max-h-[88vh] overflow-y-auto' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/35 p-4"
      onClick={() => {
        if (closeOnBackdrop) onClose();
      }}
    >
      <div className={containerCls} onClick={(event) => event.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
