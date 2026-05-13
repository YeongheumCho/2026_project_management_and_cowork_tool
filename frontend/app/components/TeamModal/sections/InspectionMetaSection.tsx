'use client';

import {
  VERIFICATION_LEVEL_LABEL,
  type UserBrief,
  type VerificationLevel,
} from '../../../lib/api';
import Field from '../../form/Field';
import type { FormSetter, FormState } from '../types';

type Props = {
  f: FormState;
  set: FormSetter;
  projectParticipants: UserBrief[];
  isOfficial: boolean;
};

/**
 * 공식 / 정기 / 변경점 검증 공통 메타 (제어기, LEVEL, 담당).
 * `isOfficial` 인 경우에만 우선순위 필드가 노출된다.
 */
export default function InspectionMetaSection({
  f,
  set,
  projectParticipants,
  isOfficial,
}: Props) {
  return (
    <section className="rounded-xl border border-border p-4">
      <h4 className="mb-3 text-sm font-semibold text-text">
        검증 메타 (제어기 / LEVEL / 담당)
      </h4>
      <div className="grid gap-3 sm:grid-cols-3">
        {isOfficial && (
          <Field label="우선순위">
            <input
              value={f.priority}
              onChange={(e) => set('priority', e.target.value)}
              className="input"
              placeholder="예: P1"
            />
          </Field>
        )}
        <Field label="제어기명">
          <input
            value={f.controllerName}
            onChange={(e) => set('controllerName', e.target.value)}
            className="input"
          />
        </Field>
        <Field label="버전 정보">
          <input
            value={f.controllerVersion}
            onChange={(e) => set('controllerVersion', e.target.value)}
            className="input"
          />
        </Field>
        <Field label="나라">
          <input
            value={f.controllerCountry}
            onChange={(e) => set('controllerCountry', e.target.value)}
            className="input"
            placeholder="예: KR"
          />
        </Field>
        <Field label="TO 번호">
          <input
            value={f.toNumber}
            onChange={(e) => set('toNumber', e.target.value)}
            className="input"
          />
        </Field>
        <Field label="TO 담당자">
          <input
            value={f.toAssignee}
            onChange={(e) => set('toAssignee', e.target.value)}
            className="input"
          />
        </Field>
        <Field label="검증 LEVEL">
          <select
            value={f.verificationLevel}
            onChange={(e) =>
              set('verificationLevel', e.target.value as VerificationLevel | '')
            }
            className="input"
          >
            <option value="">선택</option>
            {Object.entries(VERIFICATION_LEVEL_LABEL).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        <Field label="차종">
          <input
            value={f.vehicleType}
            onChange={(e) => set('vehicleType', e.target.value)}
            className="input"
            placeholder="예: HEV / PHEV / CN8 LV2"
          />
        </Field>
        <Field label="완료일">
          <input
            type="date"
            value={f.completedOn}
            onChange={(e) => set('completedOn', e.target.value)}
            className="input"
          />
        </Field>
        <Field label="기능명(상세)">
          <input
            value={f.functionName}
            onChange={(e) => set('functionName', e.target.value)}
            className="input"
          />
        </Field>
        
        <Field label="기능 담당자">
          <select
            value={f.functionOwner}
            onChange={(e) => set('functionOwner', e.target.value)}
            className="input"
          >
            <option value="">선택</option>
            {projectParticipants.map((user) => (
              <option key={user.id} value={user.name}>
                {user.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="검증(자동화) 담당">
          <select
            value={f.verifierId}
            onChange={(e) =>
              set(
                'verifierId',
                e.target.value === '' ? '' : Number(e.target.value),
              )
            }
            className="input"
          >
            <option value="">선택</option>
            {projectParticipants.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>

        </Field>
        <Field label="리뷰 담당">
          <select
            value={f.reviewerId}
            onChange={(e) =>
              set(
                'reviewerId',
                e.target.value === '' ? '' : Number(e.target.value),
              )
            }
            className="input"
          >
            <option value="">선택</option>
            {projectParticipants.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="검증 자리">
          <input
            value={f.seatNo}
            onChange={(e) => set('seatNo', e.target.value)}
            className="input"
          />
        </Field>
        <Field label="제어기 번호">
          <input
            value={f.controllerNo}
            onChange={(e) => set('controllerNo', e.target.value)}
            className="input"
          />
        </Field>
        <Field label="평균 예상 소요(분)">
          <input
            type="number"
            min={0}
            value={f.avgExpectedMinutes}
            onChange={(e) => set('avgExpectedMinutes', e.target.value)}
            className="input"
          />
        </Field>
        <Field label="특이사항" full>
          <textarea
            value={f.specialNote}
            onChange={(e) => set('specialNote', e.target.value)}
            className="input min-h-[60px]"
          />
        </Field>
        <Field label="이슈 / 진행 상황" full>
          <textarea
            value={f.issueNote}
            onChange={(e) => set('issueNote', e.target.value)}
            className="input min-h-[60px]"
          />
        </Field>
      </div>
    </section>
  );
}
