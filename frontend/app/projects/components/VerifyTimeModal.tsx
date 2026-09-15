'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import Modal from '../../components/Modal';
import InlineMessage, { type MessageTone } from '../../components/InlineMessage';
import {
  apiFetch,
  FIRST_VERIFY_STATES,
  INREVIEW_STATES,
  TIME_ENTRY_FIELD_LABEL,
  TIME_ENTRY_ROLE_LABEL,
  TIME_ENTRY_STAGE_LABEL,
  TIME_ENTRY_STAGES,
  VERIFY_STATE_LABEL,
  type SubProject,
  type SubProjectTimeEntry,
  type SubProjectTimeSummary,
  type TimeEntryRole,
  type TimeEntryStage,
  type VerifyState,
} from '../../lib/api';
import { toISODate } from '../../lib/calendar';

type Props = {
  open: boolean;
  subproject: SubProject | null;
  meId?: number | null;
  isAdmin?: boolean;
  onClose: () => void;
  onSaved?: () => Promise<void> | void;
};

const ROLE_OPTIONS: TimeEntryRole[] = ['verifier', 'reviewer', 'inreviewer', 'assignee'];

function stateOptions(stage: TimeEntryStage): VerifyState[] {
  return stage === 'inreview' ? INREVIEW_STATES : FIRST_VERIFY_STATES;
}

function minutesLabel(value: number) {
  if (value < 60) return `${value}분`;
  const hours = Math.floor(value / 60);
  const rest = value % 60;
  return rest === 0 ? `${hours}시간` : `${hours}시간 ${rest}분`;
}

export default function VerifyTimeModal({
  open,
  subproject,
  meId,
  isAdmin = false,
  onClose,
  onSaved,
}: Props) {
  const [summary, setSummary] = useState<SubProjectTimeSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [tone, setTone] = useState<MessageTone>('info');

  const [stage, setStage] = useState<TimeEntryStage>('first_verify');
  const [role, setRole] = useState<TimeEntryRole>('verifier');
  const [setupMin, setSetupMin] = useState('');
  const [audMin, setAudMin] = useState('');
  const [workMin, setWorkMin] = useState('');
  const [state, setState] = useState<string>('');
  const [issueNote, setIssueNote] = useState('');
  const [workedOn, setWorkedOn] = useState(toISODate(new Date()));

  const fieldLabels = TIME_ENTRY_FIELD_LABEL[stage];

  const load = useCallback(async () => {
    if (!open || !subproject) return;
    setLoading(true);
    setMessage('');
    try {
      const fetched = await apiFetch<SubProjectTimeSummary>(
        `/subprojects/${subproject.id}/time-entries`,
      );
      setSummary(fetched);
    } catch (error) {
      setTone('error');
      setMessage((error as Error).message);
    } finally {
      setLoading(false);
    }
  }, [open, subproject]);

  useEffect(() => {
    if (!open) return;
    setStage('first_verify');
    setRole('verifier');
    setWorkedOn(toISODate(new Date()));
    void load();
  }, [load, open]);

  // 이미 남긴 기록이 있는 단계를 고르면 그 값을 불러와 수정 모드처럼 쓴다.
  const myEntry = useMemo(
    () =>
      summary?.entries.find(
        (entry) => entry.user_id === meId && entry.stage === stage,
      ) ?? null,
    [summary, meId, stage],
  );

  useEffect(() => {
    setSetupMin(myEntry?.setup_min == null ? '' : String(myEntry.setup_min));
    setAudMin(myEntry?.aud_min == null ? '' : String(myEntry.aud_min));
    setWorkMin(myEntry?.work_min == null ? '' : String(myEntry.work_min));
    setState(myEntry?.state ?? '');
    setIssueNote(myEntry?.issue_note ?? '');
    if (myEntry?.worked_on) setWorkedOn(myEntry.worked_on);
    if (myEntry?.role) setRole(myEntry.role);
  }, [myEntry]);

  function toMinutes(value: string): number | null {
    const trimmed = value.trim();
    if (trimmed === '') return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : null;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!subproject) return;

    const setup = toMinutes(setupMin);
    const aud = fieldLabels.aud ? toMinutes(audMin) : null;
    const work = toMinutes(workMin);
    if ([setupMin, audMin, workMin].some((raw) => raw.trim() !== '' && toMinutes(raw) === null)) {
      setTone('error');
      setMessage('소요 시간은 0 이상 숫자(분)로 입력해 주세요.');
      return;
    }
    if (setup === null && aud === null && work === null) {
      setTone('error');
      setMessage('소요 시간을 한 칸 이상 입력해 주세요.');
      return;
    }

    setSaving(true);
    setMessage('');
    try {
      const fetched = await apiFetch<SubProjectTimeSummary>(
        `/subprojects/${subproject.id}/time-entries`,
        {
          method: 'PUT',
          body: JSON.stringify({
            stage,
            role,
            setup_min: setup,
            aud_min: aud,
            work_min: work,
            state: state || null,
            issue_note: issueNote.trim() || null,
            worked_on: workedOn || null,
          }),
        },
      );
      setSummary(fetched);
      setTone('success');
      setMessage('저장했습니다.');
      await onSaved?.();
    } catch (error) {
      setTone('error');
      setMessage((error as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function removeEntry(entry: SubProjectTimeEntry) {
    if (!subproject) return;
    setSaving(true);
    setMessage('');
    try {
      const fetched = await apiFetch<SubProjectTimeSummary>(
        `/subprojects/${subproject.id}/time-entries/${entry.id}`,
        { method: 'DELETE' },
      );
      setSummary(fetched);
      await onSaved?.();
    } catch (error) {
      setTone('error');
      setMessage((error as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} size="xl" scrollable ariaLabel="담당자별 검증 시간">
      <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-brand">
            검증 시간
          </p>
          <h2 className="mt-1 text-xl font-bold text-text">
            {subproject?.name ?? '하위 프로젝트'}
          </h2>
          <p className="mt-1 text-xs text-text-subtle">
            검증·리뷰·InReview에 각자 쓴 시간을 남깁니다. 합계는 남긴 기록에서 계산됩니다.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-border bg-white px-3 py-1.5 text-sm font-semibold text-text-muted hover:bg-surface-muted"
        >
          닫기
        </button>
      </div>

      <InlineMessage tone={tone} className="mt-4">{message}</InlineMessage>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <form onSubmit={submit} className="rounded-2xl border border-border bg-white p-4">
          <h3 className="text-base font-semibold text-text">
            {myEntry ? '내 기록 수정' : '내 기록 추가'}
          </h3>

          <div className="mt-4 space-y-3">
            <label className="block">
              <span className="text-xs font-medium text-text-muted">단계</span>
              <select
                value={stage}
                onChange={(event) => setStage(event.target.value as TimeEntryStage)}
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
              >
                {TIME_ENTRY_STAGES.map((value) => (
                  <option key={value} value={value}>
                    {TIME_ENTRY_STAGE_LABEL[value]}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-xs font-medium text-text-muted">역할</span>
              <select
                value={role}
                onChange={(event) => setRole(event.target.value as TimeEntryRole)}
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
              >
                {ROLE_OPTIONS.map((value) => (
                  <option key={value} value={value}>
                    {TIME_ENTRY_ROLE_LABEL[value]}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="text-xs font-medium text-text-muted">{fieldLabels.setup}</span>
                <input
                  type="number"
                  min={0}
                  value={setupMin}
                  onChange={(event) => setSetupMin(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
                />
              </label>
              {fieldLabels.aud && (
                <label className="block">
                  <span className="text-xs font-medium text-text-muted">{fieldLabels.aud}</span>
                  <input
                    type="number"
                    min={0}
                    value={audMin}
                    onChange={(event) => setAudMin(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
                  />
                </label>
              )}
            </div>

            <label className="block">
              <span className="text-xs font-medium text-text-muted">{fieldLabels.work}</span>
              <input
                type="number"
                min={0}
                value={workMin}
                onChange={(event) => setWorkMin(event.target.value)}
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
              />
            </label>

            <label className="block">
              <span className="text-xs font-medium text-text-muted">상태</span>
              <select
                value={state}
                onChange={(event) => setState(event.target.value)}
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
              >
                <option value="">선택 안 함</option>
                {stateOptions(stage).map((value) => (
                  <option key={value} value={value}>
                    {VERIFY_STATE_LABEL[value]}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-xs font-medium text-text-muted">작업일</span>
              <input
                type="date"
                value={workedOn}
                onChange={(event) => setWorkedOn(event.target.value)}
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
              />
            </label>

            <label className="block">
              <span className="text-xs font-medium text-text-muted">이슈</span>
              <textarea
                value={issueNote}
                onChange={(event) => setIssueNote(event.target.value)}
                placeholder="이 단계에서 겪은 이슈"
                className="mt-1 min-h-[84px] w-full rounded-lg border border-border px-3 py-2 text-sm"
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={saving || !subproject}
            className="mt-4 w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? '저장 중...' : myEntry ? '기록 수정' : '기록 저장'}
          </button>
        </form>

        <section className="rounded-2xl border border-border bg-surface-muted p-4">
          <div className="rounded-xl border border-border bg-white p-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-text">단계별 합계</h3>
              <p className="text-xs font-semibold text-text">
                총 {minutesLabel(summary?.total_min ?? 0)}
              </p>
            </div>
            <ul className="mt-3 space-y-1.5">
              {(summary?.stages ?? []).map((item) => (
                <li
                  key={item.stage}
                  className="flex items-center justify-between gap-3 text-xs"
                >
                  <span className="text-text">
                    {item.stage_label}
                    {item.from_legacy ? (
                      <span className="ml-1 text-text-subtle">
                        (기존 입력값 · 담당자 기록 없음)
                      </span>
                    ) : (
                      <span className="ml-1 text-text-subtle">{item.person_count}명 합산</span>
                    )}
                  </span>
                  <span className="shrink-0 font-semibold text-text">
                    {minutesLabel(item.total_min)}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <h3 className="mt-4 text-base font-semibold text-text">담당자별 기록</h3>
          <div className="mt-3 max-h-[360px] space-y-2 overflow-y-auto pr-1">
            {loading && (
              <p className="py-8 text-center text-sm text-text-faint">불러오는 중...</p>
            )}
            {!loading && (summary?.entries.length ?? 0) === 0 && (
              <p className="py-8 text-center text-sm text-text-faint">
                아직 담당자별 기록이 없습니다. 합계는 기존 입력값을 그대로 보여줍니다.
              </p>
            )}
            {!loading &&
              (summary?.entries ?? []).map((entry) => (
                <div key={entry.id} className="rounded-xl border border-border bg-white p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="min-w-0 truncate text-sm font-semibold text-text">
                      {entry.user_name ?? `#${entry.user_id}`}
                      <span className="ml-2 text-xs font-medium text-text-subtle">
                        {TIME_ENTRY_STAGE_LABEL[entry.stage]} · {TIME_ENTRY_ROLE_LABEL[entry.role]}
                      </span>
                    </p>
                    <p className="shrink-0 text-xs font-semibold text-text">
                      {minutesLabel(entry.total_min)}
                    </p>
                  </div>
                  <p className="mt-1 text-xs text-text-muted">
                    세팅 {entry.setup_min ?? 0} · AUD {entry.aud_min ?? 0} · 작성 {entry.work_min ?? 0}
                    {entry.worked_on ? ` · ${entry.worked_on}` : ''}
                  </p>
                  {entry.state && (
                    <p className="mt-1 text-xs text-text-subtle">
                      상태: {VERIFY_STATE_LABEL[entry.state]}
                    </p>
                  )}
                  {entry.issue_note && (
                    <p className="mt-1 text-xs text-text-muted">{entry.issue_note}</p>
                  )}
                  {(isAdmin || entry.user_id === meId) && (
                    <button
                      type="button"
                      onClick={() => removeEntry(entry)}
                      disabled={saving}
                      className="mt-2 rounded-lg border border-border px-2 py-1 text-tiny font-semibold text-text-muted hover:bg-surface-muted disabled:opacity-50"
                    >
                      기록 삭제
                    </button>
                  )}
                </div>
              ))}
          </div>
        </section>
      </div>
    </Modal>
  );
}
