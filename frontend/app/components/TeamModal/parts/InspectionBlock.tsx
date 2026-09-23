'use client';

import { VERIFY_STATE_LABEL, type VerifyState } from '../../../lib/api';
import Field from '../../form/Field';

type Props = {
  title: string;
  status: VerifyState | '';
  onStatus: (v: VerifyState | '') => void;
  setup: string;
  onSetup: (v: string) => void;
  aud: string;
  onAud: (v: string) => void;
  extraLabel: string;
  extra: string;
  onExtra: (v: string) => void;
};

/**
 * 1차 검증 / InReview 에서 공통으로 쓰이는 상태+소요시간 블록.
 * 총 소요(분)는 세 필드의 단순 합.
 */
export default function InspectionBlock({
  title,
  status,
  onStatus,
  setup,
  onSetup,
  aud,
  onAud,
  extraLabel,
  extra,
  onExtra,
}: Props) {
  const total =
    (Number(setup) || 0) + (Number(aud) || 0) + (Number(extra) || 0);

  return (
    <div className="rounded-lg border border-border-subtle bg-surface-muted p-3">
      <p className="mb-2 text-xs font-semibold text-text-muted">{title}</p>
      <Field label="검증 상태">
        <select
          value={status}
          onChange={(e) => onStatus(e.target.value as VerifyState | '')}
          className="input"
        >
          <option value="">선택</option>
          {Object.entries(VERIFY_STATE_LABEL).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </Field>
      <div className="mt-2 grid grid-cols-3 gap-2">
        <Field label="세팅(분)">
          <input
            type="number"
            min={0}
            value={setup}
            onChange={(e) => onSetup(e.target.value)}
            className="input"
          />
        </Field>
        <Field label="AUD(분)">
          <input
            type="number"
            min={0}
            value={aud}
            onChange={(e) => onAud(e.target.value)}
            className="input"
          />
        </Field>
        {/* extraLabel이 길어도 줄 높이가 맞도록 flex 정렬 */}
        <div className="flex flex-col">
          <label className="field-label min-h-[2.5em] leading-tight">{extraLabel}</label>
          <input
            type="number"
            min={0}
            value={extra}
            onChange={(e) => onExtra(e.target.value)}
            className="input"
          />
        </div>
      </div>
      <p className="mt-2 text-right text-micro text-text-subtle">
        총 소요 {total}분
      </p>
    </div>
  );
}
