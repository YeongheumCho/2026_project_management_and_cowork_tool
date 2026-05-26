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

type Props = {
  sp: SubProject;
  onClick: (sp: SubProject) => void;
  canEdit?: boolean;
  onEdit?: (sp: SubProject) => void;
};

export default function SubProjectListItem({
  sp,
  onClick,
  canEdit = false,
  onEdit,
}: Props) {
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
    : (sp.assignee?.name ?? '미지정');

  return (
    <li>
      <div className="rounded-[20px] border border-border bg-white px-4 py-4 shadow-[0_8px_24px_rgba(28,25,23,0.04)]">
        <div className="flex flex-wrap items-start gap-3">
          <div className={`mt-1 h-2.5 w-2.5 rounded-full ${colorForId(sp.project_id)}`} />

          <button
            type="button"
            onClick={() => onClick(sp)}
            className="min-w-[220px] flex-1 text-left"
          >
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-md font-semibold text-text">{sp.name}</p>
              <span
                className={`rounded-full px-2.5 py-1 text-tiny font-bold uppercase tracking-[0.08em] ${SUBPROJECT_STATUS_BADGE[sp.status]}`}
              >
                {SUBPROJECT_STATUS_LABEL[sp.status]}
              </span>
              {sp.upload_done && (
                <span className="rounded-full border border-verify-pass-bg bg-verify-pass-bg px-2.5 py-1 text-tiny font-bold uppercase tracking-[0.08em] text-verify-pass-fg">
                  업로드 완료
                </span>
              )}
            </div>

            {metaBits.length > 0 && (
              <p className="mt-1 text-micro text-text-muted">
                {metaBits.join(' · ')}
              </p>
            )}

            {(first || inReview) && (
              <p className="mt-1 text-micro text-text-muted">
                1차 검증: {first ?? '-'} · InReview: {inReview ?? '-'}
              </p>
            )}
          </button>

          <div className="min-w-[150px] text-right">
            <p className="text-micro text-text-muted">
              {sp.start_date} - {sp.end_date}
            </p>
            <p className="mt-1 text-micro font-semibold text-text-muted">
              {assigneeLabel}
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-micro text-text-muted">
          <div className="min-w-[160px] flex-1">
            <div className="mb-1 flex items-center justify-between">
              <span>진행률</span>
              <span className="font-semibold text-text">
                {sp.progress.toFixed(0)}%
              </span>
            </div>
            <ProgressBar
              value={sp.progress}
              ariaLabel={`${sp.name} 진행률`}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onClick(sp)}
              className="rounded-lg bg-brand px-3 py-1.5 text-tiny font-bold text-white hover:bg-brand-hover"
            >
              진행률 기록
            </button>
            {canEdit && onEdit && (
              <button
                type="button"
                onClick={() => onEdit(sp)}
                className="rounded-lg border border-brand-soft bg-white px-3 py-1.5 text-tiny font-bold text-brand hover:bg-brand-soft"
              >
                하위 프로젝트 수정
              </button>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}
