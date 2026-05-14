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
    <div className="flex justify-end gap-2 border-t border-border pt-4">
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
