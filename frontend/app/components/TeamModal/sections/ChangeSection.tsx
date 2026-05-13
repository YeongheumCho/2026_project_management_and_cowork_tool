'use client';

import Field from '../../form/Field';
import type { FormSetter, FormState } from '../types';

type Props = {
  f: FormState;
  set: FormSetter;
};

/**
 * 변경점 검증(change_inspection) 전용 필드들.
 * CR 번호, IP, 피드백/재검증 소요, LIN/STD/HOLD 메모.
 */
export default function ChangeSection({ f, set }: Props) {
  return (
    <section className="rounded-xl border border-border p-4">
      <h4 className="mb-3 text-sm font-semibold text-text">
        변경점 검증 상세
      </h4>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="CR.No">
          <input
            value={f.crNo}
            onChange={(e) => set('crNo', e.target.value)}
            className="input"
          />
        </Field>
        <Field label="IP">
          <input
            value={f.ipAddr}
            onChange={(e) => set('ipAddr', e.target.value)}
            className="input"
          />
        </Field>
        <Field label="검토/피드백(분)">
          <input
            type="number"
            min={0}
            value={f.changeFeedbackMin}
            onChange={(e) => set('changeFeedbackMin', e.target.value)}
            className="input"
          />
        </Field>
        <Field label="재검증(분)">
          <input
            type="number"
            min={0}
            value={f.changeRevalidateMin}
            onChange={(e) => set('changeRevalidateMin', e.target.value)}
            className="input"
          />
        </Field>
        <Field label="LIN/STD/HOLD→FAIL 메모" full>
          <textarea
            value={f.linStdHoldNote}
            onChange={(e) => set('linStdHoldNote', e.target.value)}
            className="input min-h-[60px]"
          />
        </Field>
      </div>
    </section>
  );
}
