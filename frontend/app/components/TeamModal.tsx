'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  apiFetch,
  ETC_CATEGORY_LABEL,
  PROJECT_TYPE_LABEL,
  VERIFICATION_LEVEL_LABEL,
  VERIFY_STATE_LABEL,
  type EtcCategory,
  type Project,
  type SubProject,
  type UserBrief,
  type VerificationLevel,
  type VerifyState,
} from '../lib/api';

type Props = {
  open: boolean;
  mode: 'create' | 'edit';
  isAdmin: boolean;
  users: UserBrief[];
  projects: Project[];
  defaultDate?: string;
  lockedProjectId?: number;
  initial?: SubProject | null;
  onClose: () => void;
  onSaved: () => void;
};

type FormState = {
  projectId: number | '';
  name: string;
  assigneeId: number | '';
  startDate: string;
  endDate: string;

  priority: string;
  controllerName: string;
  controllerVersion: string;
  controllerCountry: string;
  toNumber: string;
  toAssignee: string;
  verificationLevel: VerificationLevel | '';
  vehicleType: string;
  functionName: string;
  functionOwner: string;
  verifierId: number | '';
  reviewerId: number | '';
  seatNo: string;
  controllerNo: string;
  avgExpectedMinutes: string;
  issueNote: string;
  uploadDone: boolean;
  specialNote: string;
  completedOn: string;

  firstVerifyStatus: VerifyState | '';
  firstSetupMin: string;
  firstAudMin: string;
  firstReviewMin: string;

  inreviewStatus: VerifyState | '';
  inreviewSetupMin: string;
  inreviewAudMin: string;
  inreviewFeedbackMin: string;

  crNo: string;
  ipAddr: string;
  changeFeedbackMin: string;
  changeRevalidateMin: string;
  linStdHoldNote: string;

  etcCategory: EtcCategory | '';
  etcMonth: string;
  etcDays: string;
  etcNote: string;
};

const EMPTY_FORM: FormState = {
  projectId: '',
  name: '',
  assigneeId: '',
  startDate: '',
  endDate: '',
  priority: '',
  controllerName: '',
  controllerVersion: '',
  controllerCountry: '',
  toNumber: '',
  toAssignee: '',
  verificationLevel: '',
  vehicleType: '',
  functionName: '',
  functionOwner: '',
  verifierId: '',
  reviewerId: '',
  seatNo: '',
  controllerNo: '',
  avgExpectedMinutes: '',
  issueNote: '',
  uploadDone: false,
  specialNote: '',
  completedOn: '',
  firstVerifyStatus: '',
  firstSetupMin: '',
  firstAudMin: '',
  firstReviewMin: '',
  inreviewStatus: '',
  inreviewSetupMin: '',
  inreviewAudMin: '',
  inreviewFeedbackMin: '',
  crNo: '',
  ipAddr: '',
  changeFeedbackMin: '',
  changeRevalidateMin: '',
  linStdHoldNote: '',
  etcCategory: '',
  etcMonth: '',
  etcDays: '',
  etcNote: '',
};

function fromSubProject(sp: SubProject): FormState {
  return {
    projectId: sp.project_id,
    name: sp.name,
    assigneeId: sp.assignee_id ?? '',
    startDate: sp.start_date,
    endDate: sp.end_date,
    priority: sp.priority ?? '',
    controllerName: sp.controller_name ?? '',
    controllerVersion: sp.controller_version ?? '',
    controllerCountry: sp.controller_country ?? '',
    toNumber: sp.to_number ?? '',
    toAssignee: sp.to_assignee ?? '',
    verificationLevel: (sp.verification_level ?? '') as VerificationLevel | '',
    vehicleType: sp.vehicle_type ?? '',
    functionName: sp.function_name ?? '',
    functionOwner: sp.function_owner ?? '',
    verifierId: sp.verifier_id ?? '',
    reviewerId: sp.reviewer_id ?? '',
    seatNo: sp.seat_no ?? '',
    controllerNo: sp.controller_no ?? '',
    avgExpectedMinutes:
      sp.avg_expected_minutes != null ? String(sp.avg_expected_minutes) : '',
    issueNote: sp.issue_note ?? '',
    uploadDone: !!sp.upload_done,
    specialNote: sp.special_note ?? '',
    completedOn: sp.completed_on ?? '',
    firstVerifyStatus: (sp.first_verify_status ?? '') as VerifyState | '',
    firstSetupMin: sp.first_setup_min != null ? String(sp.first_setup_min) : '',
    firstAudMin: sp.first_aud_min != null ? String(sp.first_aud_min) : '',
    firstReviewMin:
      sp.first_review_min != null ? String(sp.first_review_min) : '',
    inreviewStatus: (sp.inreview_status ?? '') as VerifyState | '',
    inreviewSetupMin:
      sp.inreview_setup_min != null ? String(sp.inreview_setup_min) : '',
    inreviewAudMin: sp.inreview_aud_min != null ? String(sp.inreview_aud_min) : '',
    inreviewFeedbackMin:
      sp.inreview_feedback_min != null ? String(sp.inreview_feedback_min) : '',
    crNo: sp.cr_no ?? '',
    ipAddr: sp.ip_addr ?? '',
    changeFeedbackMin:
      sp.change_feedback_min != null ? String(sp.change_feedback_min) : '',
    changeRevalidateMin:
      sp.change_revalidate_min != null ? String(sp.change_revalidate_min) : '',
    linStdHoldNote: sp.lin_std_hold_note ?? '',
    etcCategory: (sp.etc_category ?? '') as EtcCategory | '',
    etcMonth: sp.etc_month ?? '',
    etcDays: sp.etc_days != null ? String(sp.etc_days) : '',
    etcNote: sp.etc_note ?? '',
  };
}

function numOrUndef(s: string): number | undefined {
  if (s === '' || s == null) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

function strOrNull(s: string): string | null {
  return s.trim() === '' ? null : s;
}

export default function TeamModal({
  open,
  mode,
  isAdmin,
  users,
  projects,
  defaultDate,
  lockedProjectId,
  initial,
  onClose,
  onSaved,
}: Props) {
  const [f, setF] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    if (mode === 'edit' && initial) {
      setF(fromSubProject(initial));
    } else {
      setF({
        ...EMPTY_FORM,
        projectId: lockedProjectId ?? projects[0]?.id ?? '',
        startDate: defaultDate ?? '',
        endDate: defaultDate ?? '',
      });
    }
    setError('');
  }, [open, mode, initial, defaultDate, projects, lockedProjectId]);

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === f.projectId),
    [projects, f.projectId],
  );
  const projectType = selectedProject?.project_type ?? 'general';
  const isInspection =
    projectType === 'official_inspection' ||
    projectType === 'regular_inspection' ||
    projectType === 'change_inspection';
  const isChange = projectType === 'change_inspection';
  const isOfficial = projectType === 'official_inspection';
  const isEtc = projectType === 'etc_task';

  if (!open) return null;

  const invalid =
    !f.name.trim() ||
    !f.projectId ||
    !f.assigneeId ||
    !f.startDate ||
    !f.endDate ||
    f.endDate < f.startDate;

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setF((prev) => ({ ...prev, [key]: value }));

  const buildPayload = () => ({
    project_id: f.projectId,
    name: f.name,
    assignee_id: f.assigneeId,
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
  });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    if (invalid) return;
    setSaving(true);
    setError('');
    try {
      if (mode === 'create') {
        await apiFetch('/subprojects', {
          method: 'POST',
          body: JSON.stringify(buildPayload()),
        });
      } else if (initial) {
        const { project_id: _pid, ...updatable } = buildPayload();
        await apiFetch(`/subprojects/${initial.id}`, {
          method: 'PUT',
          body: JSON.stringify(updatable),
        });
      }
      onSaved();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!initial || !isAdmin) return;
    if (initial.status === 'completed') return;
    if (!window.confirm('이 소프로젝트를 삭제할까요?')) return;
    setSaving(true);
    setError('');
    try {
      await apiFetch(`/subprojects/${initial.id}`, { method: 'DELETE' });
      onSaved();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold">
              {mode === 'create' ? '소프로젝트 추가' : '소프로젝트 수정'}
            </h3>
            {selectedProject && (
              <p className="mt-0.5 text-xs text-slate-500">
                {selectedProject.name} ·{' '}
                {PROJECT_TYPE_LABEL[selectedProject.project_type] ??
                  selectedProject.project_type}
              </p>
            )}
          </div>
          {mode === 'edit' && isAdmin && initial?.status !== 'completed' && (
            <button
              onClick={handleDelete}
              className="rounded-lg border border-red-200 px-3 py-1 text-sm text-red-600 hover:bg-red-50"
            >
              × 삭제
            </button>
          )}
        </div>

        {!isAdmin && (
          <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
            이 화면은 관리자만 수정할 수 있습니다.
          </p>
        )}

        <form onSubmit={submit} className="mt-4 space-y-5">
          {/* ===== 공통 기본 ===== */}
          <section className="rounded-xl border border-slate-200 p-4">
            <h4 className="mb-3 text-sm font-semibold text-slate-700">기본 정보</h4>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="프로젝트">
                <select
                  value={f.projectId}
                  onChange={(e) => set('projectId', Number(e.target.value))}
                  disabled={
                    !isAdmin || mode === 'edit' || lockedProjectId !== undefined
                  }
                  className="input"
                >
                  <option value="">프로젝트 선택</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({PROJECT_TYPE_LABEL[p.project_type] ?? '일반'})
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={isEtc ? '업무 제목' : '소프로젝트 / 기능명'}>
                <input
                  value={f.name}
                  onChange={(e) => set('name', e.target.value)}
                  disabled={!isAdmin}
                  className="input"
                  placeholder={isEtc ? '예: 4월 휴가' : '예: 로그인 기능 개발'}
                />
              </Field>
              <Field label="담당자">
                <select
                  value={f.assigneeId}
                  onChange={(e) => set('assigneeId', Number(e.target.value))}
                  disabled={!isAdmin}
                  className="input"
                >
                  <option value="">팀원 선택</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.role === 'admin' ? '관리자' : '일반'})
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="시작일 ~ 종료일">
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={f.startDate}
                    onChange={(e) => set('startDate', e.target.value)}
                    disabled={!isAdmin}
                    className="input"
                  />
                  <input
                    type="date"
                    value={f.endDate}
                    onChange={(e) => set('endDate', e.target.value)}
                    disabled={!isAdmin}
                    className="input"
                  />
                </div>
                {f.startDate && f.endDate && f.endDate < f.startDate && (
                  <p className="mt-1 text-xs text-red-500">
                    종료일은 시작일 이후여야 합니다.
                  </p>
                )}
              </Field>
            </div>
          </section>

          {/* ===== 검증 공통 메타 ===== */}
          {isInspection && (
            <section className="rounded-xl border border-slate-200 p-4">
              <h4 className="mb-3 text-sm font-semibold text-slate-700">
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
                  <input
                    value={f.functionOwner}
                    onChange={(e) => set('functionOwner', e.target.value)}
                    className="input"
                  />
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
                    {users.map((u) => (
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
                    {users.map((u) => (
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
          )}

          {/* ===== 1차 검증 vs InReview ===== */}
          {isInspection && (
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
          )}

          {/* ===== 변경점 검증 전용 ===== */}
          {isChange && (
            <section className="rounded-xl border border-slate-200 p-4">
              <h4 className="mb-3 text-sm font-semibold text-slate-700">
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
          )}

          {/* ===== 기타 업무 ===== */}
          {isEtc && (
            <section className="rounded-xl border border-slate-200 p-4">
              <h4 className="mb-3 text-sm font-semibold text-slate-700">
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
          )}

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm hover:bg-slate-50"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={!isAdmin || invalid || saving}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {mode === 'create' ? '추가' : '저장'}
            </button>
          </div>
        </form>

        <style jsx>{`
          :global(.input) {
            margin-top: 0.25rem;
            width: 100%;
            border-radius: 0.5rem;
            border: 1px solid rgb(226 232 240);
            padding: 0.5rem 0.75rem;
            font-size: 0.875rem;
            background: white;
          }
          :global(.input:disabled) {
            background: rgb(248 250 252);
          }
        `}</style>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div className={full ? 'sm:col-span-3' : ''}>
      <label className="block text-xs font-medium text-slate-600">{label}</label>
      {children}
    </div>
  );
}

function InspectionBlock({
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
}: {
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
}) {
  const total =
    (Number(setup) || 0) + (Number(aud) || 0) + (Number(extra) || 0);
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
      <p className="mb-2 text-xs font-semibold text-slate-600">{title}</p>
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
        <Field label={extraLabel}>
          <input
            type="number"
            min={0}
            value={extra}
            onChange={(e) => onExtra(e.target.value)}
            className="input"
          />
        </Field>
      </div>
      <p className="mt-2 text-right text-[11px] text-slate-500">
        총 소요 {total}분
      </p>
    </div>
  );
}
