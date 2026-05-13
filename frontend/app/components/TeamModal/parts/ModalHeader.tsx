'use client';

import { PROJECT_TYPE_LABEL, type Project } from '../../../lib/api';

const TEXT = {
  detail: '\ud300 \uce98\ub9b0\ub354 \ud558\uc704 \ud504\ub85c\uc81d\ud2b8 \uc815\ubcf4',
  create: '\ud558\uc704 \ud504\ub85c\uc81d\ud2b8 \ucd94\uac00',
  edit: '\ud558\uc704 \ud504\ub85c\uc81d\ud2b8 \uc218\uc815',
  delete: '\ud558\uc704 \ud504\ub85c\uc81d\ud2b8 \uc0ad\uc81c',
  separator: ' \u00b7 ',
} as const;

type Props = {
  mode: 'create' | 'edit';
  selectedProject?: Project;
  canDelete: boolean;
  onDelete: () => void;
};

export default function ModalHeader({
  mode,
  selectedProject,
  canDelete,
  onDelete,
}: Props) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-nano font-bold uppercase tracking-[1px] text-[#888780]">
          {TEXT.detail}
        </p>
        <h3 className="mt-2 text-[19px] font-bold text-[#1A1A1A]">
          {mode === 'create' ? TEXT.create : TEXT.edit}
        </h3>
        {selectedProject && (
          <p className="mt-1 text-micro text-[#888780]">
            {selectedProject.name}
            {TEXT.separator}
            {PROJECT_TYPE_LABEL[selectedProject.project_type] ??
              selectedProject.project_type}
          </p>
        )}
      </div>

      {canDelete && (
        <button
          type="button"
          onClick={onDelete}
          className="rounded-lg border border-[#F4C9C9] px-3 py-1.5 text-micro font-bold text-[#A32D2D] hover:bg-[#FCEBEB]"
        >
          {TEXT.delete}
        </button>
      )}
    </div>
  );
}
