'use client';

type Props = {
  mode: 'create' | 'edit';
  saving: boolean;
  invalid: boolean;
  isAdmin: boolean;
  onCancel: () => void;
};

/**
 * 모달 하단의 취소/저장 액션.
 * 저장 버튼은 submit 타입으로 외부 <form> 과 연결됨.
 */
export default function ModalFooter({
  mode,
  saving,
  invalid,
  isAdmin,
  onCancel,
}: Props) {
  return (
    <div className="flex justify-end gap-2 pt-2">
      <button
        type="button"
        onClick={onCancel}
        className="rounded-lg border border-slate-200 px-4 py-2 text-sm hover:bg-slate-50"
      >
        취소
      </button>
      <button
        type="submit"
        disabled={!isAdmin || invalid || saving}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {mode === 'create' ? '추가' : '저장'}
      </button>
    </div>
  );
}
