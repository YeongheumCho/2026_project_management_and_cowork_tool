'use client';

import InspectionBlock from '../parts/InspectionBlock';
import type { FormSetter, FormState } from '../types';

type Props = {
  f: FormState;
  set: FormSetter;
};

/**
 * 1차 검증과 InReview(N차 피드백) 블록을 나란히 렌더.
 * 하단의 "업로드 완료" 체크박스는 두 검증 결과에 대한 공통 플래그.
 */
export default function InspectionStatusSection({ f, set }: Props) {
  return (
    <section className="rounded-xl border border-slate-200 p-4">
      <h4 className="mb-3 text-sm font-semibold text-slate-700">
        검증 상태 & 소요 시간
      </h4>
      <div className="grid gap-4 md:grid-cols-2">
        <InspectionBlock
          title="1차 검증"
          status={f.firstVerifyStatus}
          onStatus={(v) => set('firstVerifyStatus', v)}
          setup={f.firstSetupMin}
          onSetup={(v) => set('firstSetupMin', v)}
          aud={f.firstAudMin}
          onAud={(v) => set('firstAudMin', v)}
          extraLabel="Review 작성/재검증(분)"
          extra={f.firstReviewMin}
          onExtra={(v) => set('firstReviewMin', v)}
        />
        <InspectionBlock
          title="InReview (N차 피드백 반영)"
          status={f.inreviewStatus}
          onStatus={(v) => set('inreviewStatus', v)}
          setup={f.inreviewSetupMin}
          onSetup={(v) => set('inreviewSetupMin', v)}
          aud={f.inreviewAudMin}
          onAud={(v) => set('inreviewAudMin', v)}
          extraLabel="코디 InReview(분)"
          extra={f.inreviewFeedbackMin}
          onExtra={(v) => set('inreviewFeedbackMin', v)}
        />
      </div>
      <div className="mt-3 flex items-center gap-3 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={f.uploadDone}
            onChange={(e) => set('uploadDone', e.target.checked)}
          />
          업로드 완료
        </label>
      </div>
    </section>
  );
}
