'use client';

import { ReactNode, useEffect } from 'react';

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
  /** true면 backdrop 클릭으로 닫힘 (기본 true) */
  closeOnBackdrop?: boolean;
  /** true면 ESC 키로 닫힘 (기본 true) */
  closeOnEsc?: boolean;
  /** 내용이 길어 스크롤이 필요한 폼에 사용 */
  scrollable?: boolean;
  ariaLabel?: string;
  children: ReactNode;
};

/**
 * 공통 모달 베이스
 * - PersonalModal / TeamModal 의 backdrop·container 패턴을 통합
 * - 기본 사이즈: md (max-w-lg)
 * - scrollable=true 시 max-h 92vh 와 overflow-y-auto 적용 (TeamModal 패턴)
 */
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
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, closeOnEsc, onClose]);

  if (!open) return null;

  const handleBackdrop = () => {
    if (closeOnBackdrop) onClose();
  };

  const containerCls = [
    'w-full rounded-2xl bg-white p-6 shadow-xl',
    SIZE_CLASS[size],
    scrollable ? 'max-h-[92vh] overflow-y-auto' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={handleBackdrop}
    >
      <div className={containerCls} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
