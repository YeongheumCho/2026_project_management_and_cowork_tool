'use client';

import { PROJECT_TYPE_LABEL, type Project } from '../../../lib/api';

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
        <p className="text-[9px] font-bold uppercase tracking-[1px] text-[#888780]">
          Team calendar subproject details
        </p>
        <h3 className="mt-2 text-[19px] font-bold text-[#1A1A1A]">
          {mode === 'create' ? 'Add subproject' : 'Edit subproject'}
        </h3>
        {selectedProject && (
          <p className="mt-1 text-[11px] text-[#888780]">
            {selectedProject.name} ·{' '}
            {PROJECT_TYPE_LABEL[selectedProject.project_type] ??
              selectedProject.project_type}
          </p>
        )}
      </div>

      {canDelete && (
        <button
          type="button"
          onClick={onDelete}
          className="rounded-lg border border-[#F4C9C9] px-3 py-1.5 text-[11px] font-bold text-[#A32D2D] hover:bg-[#FCEBEB]"
        >
          Delete subproject
        </button>
      )}
    </div>
  );
}
