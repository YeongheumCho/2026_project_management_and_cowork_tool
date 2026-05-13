'use client';

import { ETC_CATEGORY_LABEL, type EtcCategory } from '../../../lib/api';
import Field from '../../form/Field';
import type { FormSetter, FormState } from '../types';

type Props = {
  f: FormState;
  set: FormSetter;
};

/**
 * 기타 업무(etc_task) 전용 필드: 카테고리, 월, 소요일(DAY), 비고.
 */
export default function EtcSection({ f, set }: Props) {
  return (
    <section className="rounded-xl border border-border p-4">
      <h4 className="mb-3 text-sm font-semibold text-text">
        기타 업무 정보
      </h4>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="카테고리">
          <select
            value={f.etcCategory}
            onChange={(e) =>
              set('etcCategory', e.target.value as EtcCategory | '')
            }
            className="input"
          >
            <option value="">선택</option>
            {Object.entries(ETC_CATEGORY_LABEL).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        <Field label="월 (YYYY-MM)">
          <input
            type="month"
            value={f.etcMonth}
            onChange={(e) => set('etcMonth', e.target.value)}
            className="input"
          />
        </Field>
        <Field label="소요일(DAY)">
          <input
            type="number"
            min={0}
            step="0.5"
            value={f.etcDays}
            onChange={(e) => set('etcDays', e.target.value)}
            className="input"
          />
        </Field>
        <Field label="비고 / 상세" full>
          <textarea
            value={f.etcNote}
            onChange={(e) => set('etcNote', e.target.value)}
            className="input min-h-[60px]"
          />
        </Field>
      </div>
    </section>
  );
}
