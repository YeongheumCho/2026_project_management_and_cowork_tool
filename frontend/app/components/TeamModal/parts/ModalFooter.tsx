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
    <div className="flex justify-end gap-2 border-t border-[#EAEAE4] pt-4">
      <button
        type="button"
        onClick={onCancel}
        className="rounded-lg border border-[#D3D1C7] px-4 py-2 text-[11px] font-bold text-[#5F5E5A] hover:bg-[#F8F8F5]"
      >
        취소
      </button>
      <button
        type="submit"
        disabled={!isAdmin || invalid || saving}
        className="rounded-lg bg-[#534AB7] px-4 py-2 text-[11px] font-bold text-white disabled:opacity-50"
      >
        {saving ? '저장 중...' : mode === 'create' ? '추가' : '저장'}
      </button>
    </div>
  );
}
