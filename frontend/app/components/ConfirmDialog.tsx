'use client';

import Modal from './Modal';
import Button from './Button';

type Props = {
  open: boolean;
  title: string;
  /** 본문 설명. 줄바꿈(\n) 을 그대로 반영한다. */
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** 확인 버튼 톤 — 파괴적 동작은 danger */
  variant?: 'danger' | 'primary';
  /** 처리 중 — 버튼 로딩 표시 + 닫기 차단 */
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

/**
 * 공통 확인 대화상자
 * - window.confirm 대체용. 브라우저 기본 대화상자 대신 앱 UI 를 사용한다.
 * - Modal / Button 을 그대로 재사용한다.
 */
export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = '확인',
  cancelLabel = '취소',
  variant = 'danger',
  busy = false,
  onConfirm,
  onClose,
}: Props) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      ariaLabel={title}
      closeOnBackdrop={!busy}
      closeOnEsc={!busy}
    >
      <h3 className="text-[17px] font-bold text-text">{title}</h3>

      {description && (
        <p className="mt-2 whitespace-pre-line text-sm text-text-subtle">
          {description}
        </p>
      )}

      <div className="mt-6 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose} disabled={busy}>
          {cancelLabel}
        </Button>
        <Button variant={variant} onClick={onConfirm} loading={busy}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
