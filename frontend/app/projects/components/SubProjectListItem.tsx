'use client';

import {
  VERIFICATION_LEVEL_LABEL,
  VERIFY_STATE_LABEL,
  type SubProject,
} from '../../lib/api';
import { colorForId } from '../../components/AppShell/colors';
import ProgressBar from '../../components/ProgressBar';
import {
  SUBPROJECT_STATUS_BADGE,
  SUBPROJECT_STATUS_LABEL,
} from '../../lib/subprojectStatus';

const TEXT = {
  uploadDone: '업로드 완료',
  firstVerify: '1차 검증',
  inReview: '인리뷰',
  unassigned: '미지정',
  progress: '진행률',
  separator: ' · ',
} as const;

type Props = {
  sp: SubProject;
  onClick: (sp: SubProject) => void;
  canEdit?: boolean;
  onEdit?: (sp: SubProject) => void;
};

export default function SubProjectListItem({ sp, onClick, canEdit = false, onEdit }: Props) {
  const level = sp.verification_level
    ? VERIFICATION_LEVEL_LABEL[sp.verification_level]
    : null;
  const first = sp.first_verify_status
    ? VERIFY_STATE_LABEL[sp.first_verify_status]
    : null;
  const inReview = sp.inreview_status
    ? VERIFY_STATE_LABEL[sp.inreview_status]
    : null;
  const metaBits = [sp.controller_name, level, sp.vehicle_type].filter(Boolean);
  const assigneeLabel = sp.assignees?.length
    ? sp.assignees.map((assignee) => assignee.name).join(', ')
    : (sp.assignee?.name ?? TEXT.unassigned);

  return (
    <li>
      <div
        role="button"
        tabIndex={0}
        onClick={() => onClick(sp)}
        onKeyDown={(event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          onClick(sp);
        }}
        className="block w-full rounded-[20px] border border-[#ECE9DF] bg-white px-4 py-4 text-left shadow-[0_8px_24px_rgba(28,25,23,0.04)] transition hover:border-[#D9D3FF] hover:bg-[#FEFEFF]"
      >
        <div className="flex flex-wrap items-start gap-3">
          <div className={`mt-1 h-2.5 w-2.5 rounded-full ${colorForId(sp.project_id)}`} />

          <div className="min-w-[220px] flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-md font-semibold text-[#1D1D1B]">{sp.name}</p>
              <span
                className={`rounded-full px-2.5 py-1 text-tiny font-bold uppercase tracking-[0.08em] ${SUBPROJECT_STATUS_BADGE[sp.status]}`}
              >
                {SUBPROJECT_STATUS_LABEL[sp.status]}
              </span>
              {sp.upload_done && (
                <span className="rounded-full border border-[#D8F0DE] bg-[#EEF9F1] px-2.5 py-1 text-tiny font-bold uppercase tracking-[0.08em] text-[#287A43]">
                  {TEXT.uploadDone}
                </span>
              )}
            </div>

            {metaBits.length > 0 && (
              <p className="mt-1 text-micro text-[#7A786F]">
                {metaBits.join(TEXT.separator)}
              </p>
            )}

            {(first || inReview) && (
              <p className="mt-1 text-micro text-[#5F5E5A]">
                {TEXT.firstVerify}: {first ?? '-'}
                {TEXT.separator}
                {TEXT.inReview}: {inReview ?? '-'}
              </p>
            )}
          </div>

          <div className="min-w-[150px] text-right">
            <p className="text-micro text-[#7A786F]">
              {sp.start_date} - {sp.end_date}
            </p>
            <p className="mt-1 text-micro font-semibold text-[#5F5E5A]">
              {assigneeLabel}
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 text-micro text-[#7A786F]">
          <div className="flex flex-1 items-center justify-between">
            <span>{TEXT.progress}</span>
            <span className="font-semibold text-[#1D1D1B]">
              {sp.progress.toFixed(0)}%
            </span>
          </div>
          {canEdit && onEdit && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onEdit(sp);
              }}
              className="rounded-lg border border-[#D8D3FF] bg-white px-3 py-1.5 text-tiny font-bold text-[#534AB7] hover:bg-[#F5F3FF]"
            >
              하위 프로젝트 수정
            </button>
          )}
        </div>

        <ProgressBar
          value={sp.progress}
          className="mt-2"
          ariaLabel={`${sp.name} ${TEXT.progress}`}
        />
      </div>
    </li>
  );
}
