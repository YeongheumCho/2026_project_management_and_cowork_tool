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
 * 1ì°¨ ê²ì¦ / InReview ìì ê³µíµì¼ë¡ ì°ì´ë ìí+ìììê° ë¸ë¡.
 * ì´ ìì(ë¶)ë ì¸ íëì ë¨ì í©.
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
    <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
      <p className="mb-2 text-xs font-semibold text-slate-600">{title}</p>
      <Field label="ê²ì¦ ìí">
        <select
          value={status}
          onChange={(e) => onStatus(e.target.value as VerifyState | '')}
          className="input"
        >
          <option value="">ì í</option>
          {Object.entries(VERIFY_STATE_LABEL).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </Field>
      <div className="mt-2 grid grid-cols-3 gap-2">
        <Field label="ì¸í(ë¶)">
          <input
            type="number"
            min={0}
            value={setup}
            onChange={(e) => onSetup(e.target.value)}
            className="input"
          />
        </Field>
        <Field label="AUD(ë¶)">
          <input
            type="number"
            min={0}
            value={aud}
            onChange={(e) => onAud(e.target.value)}
            className="input"
          />
        </Field>
        {/* extraLabelì´ ê¸¸ì´ë ì¤ ëì´ê° ë§ëë¡ flex ì ë ¬ */}
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
      <p className="mt-2 text-right text-micro text-slate-500">
        ì´ ìì {total}ë¶
      </p>
    </div>
  );
}
