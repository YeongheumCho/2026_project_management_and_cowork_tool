'use client';

type Props = {
  mode: 'create' | 'edit';
  saving: boolean;
  invalid: boolean;
  isAdmin: boolean;
  onCancel: () => void;
};

export default function ModalFooter({
  mode,
  saving,
  invalid,
  isAdmin,
  onCancel,
}: Props) {
  return (
    /* A-30: 모달 패널에 아래쪽 padding 24px 이 있어 sticky bottom-0 이면
       버튼 줄이 패널 바닥에서 24px 떠 보였다. 그만큼 내려 붙인다. */
    <div className="sticky -bottom-6 z-10 -mx-6 -mb-6 flex justify-end gap-2 border-t border-border bg-surface px-6 pb-6 pt-4">
      <button
        type="button"
        onClick={onCancel}
        className="rounded-lg border border-border-strong px-4 py-2 text-micro font-bold text-text-muted hover:bg-background"
      >
        취소
      </button>
      <button
        type="submit"
        disabled={!isAdmin || invalid || saving}
        className="rounded-lg bg-brand px-4 py-2 text-micro font-bold text-white disabled:opacity-50"
      >
        {saving ? '저장 중...' : mode === 'create' ? '추가' : '저장'}
      </button>
    </div>
  );
}
