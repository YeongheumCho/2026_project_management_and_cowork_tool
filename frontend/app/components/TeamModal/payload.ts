import { numOrUndef, strOrNull, type FormState } from './types';

/**
 * FormState → 백엔드 `/subprojects` 요청 payload.
 * create/edit 모드 모두에서 동일 payload를 만들고,
 * edit 에서는 project_id만 제외하여 PUT.
 */
export function buildSubProjectPayload(f: FormState) {
  return {
    project_id: f.projectId,
    name: f.name,
    assignee_id: f.assigneeIds[0] ?? f.assigneeId,
    assignee_ids: f.assigneeIds,
    start_date: f.startDate,
    end_date: f.endDate,

    priority: strOrNull(f.priority),
    controller_name: strOrNull(f.controllerName),
    controller_version: strOrNull(f.controllerVersion),
    controller_country: strOrNull(f.controllerCountry),
    to_number: strOrNull(f.toNumber),
    to_assignee: strOrNull(f.toAssignee),
    verification_level: f.verificationLevel || null,
    vehicle_type: strOrNull(f.vehicleType),
    function_name: strOrNull(f.functionName),
    function_owner: strOrNull(f.functionOwner),
    verifier_id: f.verifierId === '' ? null : f.verifierId,
    reviewer_id: f.reviewerId === '' ? null : f.reviewerId,
    seat_no: strOrNull(f.seatNo),
    controller_no: strOrNull(f.controllerNo),
    avg_expected_minutes: numOrUndef(f.avgExpectedMinutes) ?? null,
    issue_note: strOrNull(f.issueNote),
    upload_done: f.uploadDone,
    special_note: strOrNull(f.specialNote),
    completed_on: strOrNull(f.completedOn),

    first_verify_status: f.firstVerifyStatus || null,
    first_setup_min: numOrUndef(f.firstSetupMin) ?? null,
    first_aud_min: numOrUndef(f.firstAudMin) ?? null,
    first_review_min: numOrUndef(f.firstReviewMin) ?? null,

    inreview_status: f.inreviewStatus || null,
    inreview_setup_min: numOrUndef(f.inreviewSetupMin) ?? null,
    inreview_aud_min: numOrUndef(f.inreviewAudMin) ?? null,
    inreview_feedback_min: numOrUndef(f.inreviewFeedbackMin) ?? null,

    cr_no: strOrNull(f.crNo),
    ip_addr: strOrNull(f.ipAddr),
    change_feedback_min: numOrUndef(f.changeFeedbackMin) ?? null,
    change_revalidate_min: numOrUndef(f.changeRevalidateMin) ?? null,
    lin_std_hold_note: strOrNull(f.linStdHoldNote),

    etc_category: f.etcCategory || null,
    etc_month: strOrNull(f.etcMonth),
    etc_days: numOrUndef(f.etcDays) ?? null,
    etc_note: strOrNull(f.etcNote),

    weight: f.weight === '' ? null : f.weight,

    custom_fields:
      Object.keys(f.customFields).length > 0
        ? Object.fromEntries(
            Object.entries(f.customFields).filter(([, v]) => v !== '')
          )
        : null,
  };
}
