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
  uploadDone: '\uc5c5\ub85c\ub4dc \uc644\ub8cc',
  firstVerify: '1\ucc28 \uac80\uc99d',
  inReview: '\uc778\ub9ac\ubdf0',
  unassigned: '\ubbf8\uc9c0\uc815',
  progress: '\uc9c4\ud589\ub960',
  separator: ' \u00b7 ',
} as const;

type Props = {
  sp: SubProject;
  onClick: (sp: SubProject) => void;
};

export default function SubProjectListItem({ sp, onClick }: Props) {
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
      <button
        type="button"
        onClick={() => onClick(sp)}
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

        <div className="mt-4 flex items-center justify-between text-micro text-[#7A786F]">
          <span>{TEXT.progress}</span>
          <span className="font-semibold text-[#1D1D1B]">
            {sp.progress.toFixed(0)}%
          </span>
        </div>

        <ProgressBar
          value={sp.progress}
          className="mt-2"
          ariaLabel={`${sp.name} ${TEXT.progress}`}
        />
      </button>
    </li>
  );
}
