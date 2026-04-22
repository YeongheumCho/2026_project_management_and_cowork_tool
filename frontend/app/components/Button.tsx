'use client';

import { ButtonHTMLAttributes, forwardRef, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  /** 좌측 아이콘 등 */
  leading?: ReactNode;
  /** 우측 아이콘 등 */
  trailing?: ReactNode;
  /** 로딩 상태 — 클릭 비활성화 + 시각 표시 */
  loading?: boolean;
  /** 전체 너비 (모바일 폼) */
  block?: boolean;
};

/**
 * 공통 버튼 컴포넌트
 * - globals.css 의 @utility .btn / .btn-primary 등을 사용
 * - 기본: variant=secondary, size=md
 *
 * 사용 예:
 * <Button variant="primary">저장</Button>
 * <Button variant="secondary" size="sm">취소</Button>
 * <Button variant="danger" loading={busy}>삭제</Button>
 */
const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  {
    variant = 'secondary',
    size = 'md',
    leading,
    trailing,
    loading = false,
    block = false,
    disabled,
    className = '',
    children,
    type = 'button',
    ...rest
  },
  ref,
) {
  const cls = [
    'btn',
    `btn-${variant}`,
    size === 'sm' ? 'btn-sm' : '',
    block ? 'w-full' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      ref={ref}
      type={type}
      className={cls}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? (
        <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : (
        leading
      )}
      {children}
      {!loading && trailing}
    </button>
  );
});

export default Button;
