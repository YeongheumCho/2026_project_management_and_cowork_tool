'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Modal from '../../components/Modal';
import InlineMessage, { type MessageTone } from '../../components/InlineMessage';
import {
  apiFetch,
  type ProgressLog,
  type SubProject,
  type SubProjectProgressSummary,
} from '../../lib/api';
import { toISODate } from '../../lib/calendar';

type Props = {
  open: boolean;
  subproject: SubProject | null;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
  initialProgressPercent?: number;
};

const FIELD_SCHEMA_NAME_KEY = '__field_schema_name';
const LEGACY_FIELD_SCHEMA_TYPE_KEY = '__field_schema_type';

export default function ProgressLogModal({
  open,
  subproject,
  onClose,
  onSaved,
  initialProgressPercent,
}: Props) {
  const [logs, setLogs] = useState<ProgressLog[]>([]);
  const [summary, setSummary] = useState<SubProjectProgressSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [tone, setTone] = useState<MessageTone>('info');
  const [progressPercent, setProgressPercent] = useState('');
  const [workDate, setWorkDate] = useState(toISODate(new Date()));
  const [comment, setComment] = useState('');
  const appliedTemplateName = getAppliedTemplateName(subproject);

  const loadLogs = useCallback(async () => {
    if (!open || !subproject) return;
    setLoading(true);
    setMessage('');
    try {
      const [fetched, fetchedSummary] = await Promise.all([
        apiFetch<ProgressLog[]>(`/subprojects/${subproject.id}/progress`),
        apiFetch<SubProjectProgressSummary>(`/subprojects/${subproject.id}/progress/summary`)
          .catch(() => null),
      ]);
      setLogs(fetched);
      setSummary(fetchedSummary);
    } catch (error) {
      setTone('error');
      setMessage((error as Error).message);
    } finally {
      setLoading(false);
    }
  }, [open, subproject]);

  useEffect(() => {
    if (!open) return;
    setProgressPercent(
      initialProgressPercent == null ? '' : String(initialProgressPercent),
    );
    setWorkDate(toISODate(new Date()));
    setComment('');
    void loadLogs();
  }, [initialProgressPercent, loadLogs, open]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!subproject) return;

    const nextProgress = Number(progressPercent);
    if (!Number.isFinite(nextProgress) || nextProgress < 0 || nextProgress > 100) {
      setTone('error');
      setMessage('진행률은 0~100 사이 숫자로 입력해 주세요.');
      return;
    }

    setSaving(true);
    setMessage('');
    try {
      await apiFetch<ProgressLog>(`/subprojects/${subproject.id}/progress`, {
        method: 'POST',
        body: JSON.stringify({
          progress_percent: nextProgress,
          work_date: workDate,
          comment: comment.trim() || null,
        }),
      });
      setProgressPercent('');
      setComment('');
      await onSaved();
      onClose();
    } catch (error) {
      setTone('error');
      setMessage((error as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      scrollable
      ariaLabel="하위 프로젝트 진행률 기록 추가"
    >
      <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-brand">
            진행률 기록
          </p>
          <h2 className="mt-1 text-xl font-bold text-text">
            {subproject?.name ?? '하위 프로젝트'}
          </h2>
          {subproject && (
            <p className="mt-1 text-xs text-text-subtle">
              {subproject.start_date} ~ {subproject.end_date} · 현재 {Math.round(subproject.progress)}%
            </p>
          )}
          {appliedTemplateName && (
            <p className="mt-2 inline-flex rounded-full border border-brand-soft bg-brand-soft px-2.5 py-1 text-tiny font-bold text-brand">
              적용 템플릿: {appliedTemplateName}
            </p>
          )}
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
          <h3 className="text-base font-semibold text-text">기록 추가</h3>
          <div className="mt-4 space-y-3">
            <label className="block">
              <span className="text-xs font-medium text-text-muted">진행률(%)</span>
              <input
                type="number"
                min={0}
                max={100}
                value={progressPercent}
                onChange={(event) => setProgressPercent(event.target.value)}
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
                required
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-text-muted">날짜</span>
              <input
                type="date"
                value={workDate}
                onChange={(event) => setWorkDate(event.target.value)}
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
                required
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-text-muted">메모</span>
              <textarea
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                placeholder="진행 내용, 이슈, 다음 계획"
                className="mt-1 min-h-[110px] w-full rounded-lg border border-border px-3 py-2 text-sm"
              />
            </label>
          </div>
          <button
            type="submit"
            disabled={saving || !subproject}
            className="mt-4 w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? '저장 중...' : '기록 저장'}
          </button>
        </form>

        <section className="rounded-2xl border border-border bg-surface-muted p-4">
          {summary && summary.owner_count > 0 && (
            <div className="mb-4 rounded-xl border border-border bg-white p-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-text">담당자별 기여</h3>
                <p className="text-xs font-semibold text-text">
                  {summary.owner_count}명 평균 → {Math.round(summary.progress)}%
                </p>
              </div>
              <p className="mt-1 text-xs text-text-subtle">
                하위 프로젝트 진행률은 담당자별 최신 기록의 평균입니다. 한 사람이 0%를
                기록해도 다른 담당자의 기록이 남아 있으면 0%가 되지 않습니다.
              </p>
              <ul className="mt-3 space-y-1.5">
                {summary.contributions.map((item) => (
                  <li
                    key={item.user_id}
                    className="flex items-center justify-between gap-3 text-xs"
                  >
                    <span className="min-w-0 truncate text-text">
                      {item.user_name}
                      {!item.is_assignee && (
                        <span className="ml-1 text-text-subtle">(담당자 아님 · 기록만)</span>
                      )}
                    </span>
                    <span className="shrink-0 text-text-muted">
                      {item.latest_percent == null
                        ? '기록 없음 (0%)'
                        : `${item.latest_percent}%${item.work_date ? ` · ${item.work_date}` : ''}`}
                      <span className="ml-2 font-semibold text-text">
                        +{item.contributed_percent}%
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <h3 className="text-base font-semibold text-text">진행률 이력</h3>
          <div className="mt-4 max-h-[360px] space-y-2 overflow-y-auto pr-1">
            {loading && (
              <p className="py-8 text-center text-sm text-text-faint">불러오는 중...</p>
            )}
            {!loading && logs.length === 0 && (
              <p className="py-8 text-center text-sm text-text-faint">
                아직 진행률 기록이 없습니다.
              </p>
            )}
            {!loading &&
              logs.map((log) => (
                <div key={log.id} className="rounded-xl border border-border bg-white p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-text">
                      {log.progress_percent}%
                      {log.user_name && (
                        <span className="ml-2 text-xs font-medium text-text-subtle">{log.user_name}</span>
                      )}
                    </p>
                    <p className="shrink-0 text-xs text-text-subtle">{log.work_date}</p>
                  </div>
                  <p className="mt-1 text-xs text-text-muted">
                    {log.comment || '메모 없음'}
                  </p>
                </div>
              ))}
          </div>
        </section>
      </div>
    </Modal>
  );
}

function getAppliedTemplateName(subproject: SubProject | null) {
  const customFields = subproject?.custom_fields;
  const savedName = customFields?.[FIELD_SCHEMA_NAME_KEY];
  if (typeof savedName === 'string' && savedName.trim() !== '') {
    return savedName;
  }

  const legacyType = customFields?.[LEGACY_FIELD_SCHEMA_TYPE_KEY];
  if (typeof legacyType === 'string' && legacyType.trim() !== '') {
    return legacyType;
  }

  return null;
}
