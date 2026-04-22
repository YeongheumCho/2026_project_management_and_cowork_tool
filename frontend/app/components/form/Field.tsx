import { ReactNode } from 'react';

type Span = 1 | 2 | 3;

type Props = {
  label: string;
  children: ReactNode;
  /** 그리드 sm:col-span-{n} (기본 1) */
  full?: boolean;
  span?: Span;
  helper?: string;
  error?: string;
  required?: boolean;
};

/**
 * 폼 필드 베이스 — 라벨 + input 영역 + helper/error
 * - TeamModal의 인라인 Field 정의를 외부로 추출
 * - sm 이상 그리드에서 span 옵션으로 폭 제어
 */
export default function Field({
  label,
  children,
  full,
  span,
  helper,
  error,
  required,
}: Props) {
  const colSpan = full ? 'sm:col-span-3' : span === 2 ? 'sm:col-span-2' : '';
  return (
    <div className={colSpan}>
      <label className="field-label">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
      {error ? (
        <span className="field-helper text-red-600">{error}</span>
      ) : helper ? (
        <span className="field-helper">{helper}</span>
      ) : null}
    </div>
  );
}
