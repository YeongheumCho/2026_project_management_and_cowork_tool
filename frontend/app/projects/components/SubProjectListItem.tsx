'use client';

import {
  VERIFICATION_LEVEL_LABEL,
  VERIFY_STATE_LABEL,
  type SubProject,
} from '../../lib/api';
import ProgressBar from '../../components/ProgressBar';
import {
  SUBPROJECT_STATUS_BADGE,
  SUBPROJECT_STATUS_LABEL,
} from '../../lib/subprojectStatus';

type Props = {
  sp: SubProject;
  onClick: (sp: SubProject) => void;
};

/**
 * 프로젝트 상세 카드 내부에 렌더되는 소프로젝트 목록 아이템.
 * 클릭 시 TeamModal(수정) 오픈.
 */
export default function SubProjectListItem({ sp, onClick }: Props) {
  const level = sp.verification_level
    ? VERIFICATION_LEVEL_LABEL[sp.verification_level]
    : null;
  const first = sp.first_verify_status
    ? VERIFY_STATE_LABEL[sp.first_verify_status]
    : null;
  const ir = sp.inreview_status
    ? VERIFY_STATE_LABEL[sp.inreview_status]
    : null;
  const metaBits = [sp.controller_name, level, sp.vehicle_type].filter(Boolean);

  return (
    <li>
      <button
        onClick={() => onClick(sp)}
        className="block w-full rounded-xl border border-slate-100 bg-white p-3 text-left hover:bg-blue-50/40"
      >
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium">{sp.name}</p>
          <span
            className={`rounded-full px-2 py-0.5 text-micro ${SUBPROJECT_STATUS_BADGE[sp.status]}`}
          >
            {SUBPROJECT_STATUS_LABEL[sp.status]}
          </span>
          {sp.upload_done && (
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-micro text-emerald-600">
              업로드 완
            </span>
          )}
          <span className="ml-auto text-micro text-slate-500">
            {sp.start_date} ~ {sp.end_date}
          </span>
        </div>
        {metaBits.length > 0 && (
          <p className="mt-1 text-micro text-slate-500">
            {metaBits.join(' · ')}
          </p>
        )}
        {(first || ir) && (
          <p className="mt-1 text-micro text-slate-600">
            1차: {first ?? '—'} &nbsp;//&nbsp; InReview: {ir ?? '—'}
          </p>
        )}
        <div className="mt-1 flex items-center justify-between text-micro text-slate-500">
          <span>{sp.assignee?.name ?? '담당자 미지정'}</span>
          <span>{sp.progress.toFixed(0)}%</span>
        </div>
        <ProgressBar
          value={sp.progress}
          className="mt-2"
          ariaLabel={`${sp.name} 진척도`}
        />
      </button>
    </li>
  );
}
