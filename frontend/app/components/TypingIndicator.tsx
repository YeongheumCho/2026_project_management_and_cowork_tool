'use client';

/**
 * 챗봇 응답 대기 중임을 표시하는 점 3개 애니메이션.
 * globals.css 의 @utility .chat-dot (및 .delay-1/2/3) 와 함께 동작한다.
 */
export default function TypingIndicator({
  ariaLabel = '답변 생성 중',
}: {
  ariaLabel?: string;
}) {
  return (
    <div
      className="flex items-center gap-1.5"
      role="status"
      aria-live="polite"
      aria-label={ariaLabel}
    >
      <span className="chat-dot delay-1" />
      <span className="chat-dot delay-2" />
      <span className="chat-dot delay-3" />
    </div>
  );
}
