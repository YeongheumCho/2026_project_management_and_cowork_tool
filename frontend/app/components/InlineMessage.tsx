'use client';

/**
 * 폼·모달 안에서 쓰는 알림 한 줄.
 *
 * 저장 실패를 파란색(정보)으로 보여주면 성공과 구분이 안 되므로
 * 성공·실패·주의를 색으로 나눈다. 색은 globals.css 토큰만 쓴다.
 */
export type MessageTone = 'info' | 'success' | 'error' | 'warn';

const TONE_CLASS: Record<MessageTone, string> = {
  info: 'bg-verify-info-bg text-verify-info-fg',
  success: 'bg-verify-pass-bg text-verify-pass-fg',
  error: 'bg-verify-fail-bg text-verify-fail-fg',
  warn: 'bg-verify-warn-bg text-verify-warn-fg',
};

type Props = {
  children?: React.ReactNode;
  tone?: MessageTone;
  className?: string;
};

export default function InlineMessage({
  children,
  tone = 'info',
  className = '',
}: Props) {
  if (!children) return null;
  return (
    <p
      role={tone === 'error' ? 'alert' : 'status'}
      className={`rounded-lg px-3 py-2 text-small ${TONE_CLASS[tone]} ${className}`}
    >
      {children}
    </p>
  );
}
