'use client';

import { PROJECT_TYPE_LABEL, type Project } from '../../../lib/api';

type Props = {
  mode: 'create' | 'edit';
  selectedProject?: Project;
  canDelete: boolean;
  onDelete: () => void;
};

/**
 * 모달 상단 제목 + (조건부) 삭제 버튼.
 * 완료된 소프로젝트는 삭제가 금지되므로 onDelete 호출 가능 여부는 상위가 결정.
 */
export default function ModalHeader({
  mode,
  selectedProject,
  canDelete,
  onDelete,
}: Props) {
  return (
    <div className="flex items-start justify-between">
      <div>
        <h3 className="text-lg font-semibold">
          {mode === 'create' ? '소프로젝트 추가' : '소프로젝트 수정'}
        </h3>
        {selectedProject && (
          <p className="mt-0.5 text-xs text-slate-500">
            {selectedProject.name} ·{' '}
            {PROJECT_TYPE_LABEL[selectedProject.project_type] ??
              selectedProject.project_type}
          </p>
        )}
      </div>
      {canDelete && (
        <button
          onClick={onDelete}
          className="rounded-lg border border-red-200 px-3 py-1 text-sm text-red-600 hover:bg-red-50"
        >
          × 삭제
        </button>
      )}
    </div>
  );
}
