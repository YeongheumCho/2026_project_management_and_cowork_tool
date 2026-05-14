'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiFetch, type WorkLogUserSummary } from '../../lib/api';

type DateRange = {
  from: string;
  to: string;
};

type Props = {
  enabled: boolean;
  selectedUserIds?: Set<number> | null;
  dateRange: DateRange;
};

function formatSeconds(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '-';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours === 0) return `${minutes}분`;
  if (minutes === 0) return `${hours}시간`;
  return `${hours}시간 ${minutes}분`;
}

function formatDateTime(value: string | null): string {
  if (!value) return '-';
  return value.slice(0, 16).replace('T', ' ');
}

function escapeHtml(value: string | number | null | undefined): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function downloadExcel(filename: string, headers: string[], rows: Array<Array<string | number>>) {
  const tableRows = [
    `<tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr>`,
    ...rows.map(
      (row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`,
    ),
  ].join('');
  const html = `<!doctype html><html><head><meta charset="utf-8" /></head><body><table>${tableRows}</table></body></html>`;
  const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function StopwatchSummaryManager({
  enabled,
  selectedUserIds = null,
  dateRange,
}: Props) {
  const [rows, setRows] = useState<WorkLogUserSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!enabled) return;

    const params = new URLSearchParams();
    if (dateRange.from) params.set('start_date', dateRange.from);
    if (dateRange.to) params.set('end_date', dateRange.to);
    const qs = params.toString();

    setLoading(true);
    apiFetch<WorkLogUserSummary[]>(`/work-logs/admin-summary${qs ? `?${qs}` : ''}`)
      .then((next) => {
        setRows(next);
        setError('');
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [dateRange.from, dateRange.to, enabled]);

  const visibleRows = useMemo(
    () =>
      selectedUserIds
        ? rows.filter((row) => selectedUserIds.has(row.user_id))
        : rows,
    [rows, selectedUserIds],
  );

  const activeRows = useMemo(
    () =>
      [...visibleRows].sort(
        (a, b) =>
          b.running_seconds - a.running_seconds ||
          b.total_seconds - a.total_seconds ||
          a.user_name.localeCompare(b.user_name, 'ko-KR'),
      ),
    [visibleRows],
  );

  const totalSeconds = useMemo(
    () => visibleRows.reduce((sum, row) => sum + row.total_seconds, 0),
    [visibleRows],
  );

  const runningCount = useMemo(
    () => visibleRows.reduce((sum, row) => sum + row.running_count, 0),
    [visibleRows],
  );

  const exportRows = () => {
    downloadExcel(
      `스톱워치_시간_현황_${dateRange.from || '전체'}_${dateRange.to || '전체'}.xls`,
      ['담당자', '소속', '누적', '진행 중', '일시정지', '완료', '최근 업무', '최근 기록'],
      activeRows.map((row) => [
        row.user_name,
        [row.center, row.office, row.team].filter(Boolean).join(' / ') || '-',
        formatSeconds(row.total_seconds),
        formatSeconds(row.running_seconds),
        formatSeconds(row.paused_seconds),
        formatSeconds(row.completed_seconds),
        row.last_task_name ?? '-',
        formatDateTime(row.last_logged_at),
      ]),
    );
  };

  if (!enabled) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-border bg-white p-4">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-md font-bold text-text">
            스톱워치 시간 현황
          </h3>
          <p className="mt-1 text-small text-text-subtle">
            선택한 담당자와 조회 기간에 맞춰 스톱워치 누적 시간을 확인합니다.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-small">
          <span className="rounded-lg bg-brand-soft px-3 py-2 font-semibold text-brand">
            누적 {formatSeconds(totalSeconds)}
          </span>
          <span className="rounded-lg bg-verify-pass-bg px-3 py-2 font-semibold text-verify-pass-fg">
            진행 중 {runningCount}건
          </span>
          <button
            type="button"
            onClick={exportRows}
            className="rounded-lg border border-brand-soft bg-white px-3 py-2 font-semibold text-brand transition hover:bg-brand-soft"
          >
            엑셀 추출
          </button>
        </div>
      </div>

      {error && (
        <p className="mb-3 rounded-lg bg-verify-fail-bg px-3 py-2 text-small text-verify-fail-fg">
          {error}
        </p>
      )}
      {loading && (
        <p className="rounded-xl bg-surface-muted px-4 py-5 text-center text-small text-text-subtle">
          스톱워치 기록을 불러오는 중입니다.
        </p>
      )}
      {!loading && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-body">
            <thead className="bg-surface-muted text-small text-text-subtle">
              <tr>
                <th className="px-4 py-3 font-semibold">담당자</th>
                <th className="px-4 py-3 font-semibold">소속</th>
                <th className="px-4 py-3 font-semibold">누적</th>
                <th className="px-4 py-3 font-semibold">진행 중</th>
                <th className="px-4 py-3 font-semibold">일시정지</th>
                <th className="px-4 py-3 font-semibold">완료</th>
                <th className="px-4 py-3 font-semibold">최근 업무</th>
                <th className="px-4 py-3 font-semibold">최근 기록</th>
              </tr>
            </thead>
            <tbody>
              {activeRows.map((row) => (
                <tr key={row.user_id} className="border-t border-border text-text">
                  <td className="px-4 py-3 font-semibold">{row.user_name}</td>
                  <td className="px-4 py-3 text-text-muted">
                    {[row.center, row.office, row.team].filter(Boolean).join(' / ') || '-'}
                  </td>
                  <td className="px-4 py-3">{formatSeconds(row.total_seconds)}</td>
                  <td className="px-4 py-3 text-verify-pass-fg">
                    {formatSeconds(row.running_seconds)}
                  </td>
                  <td className="px-4 py-3">{formatSeconds(row.paused_seconds)}</td>
                  <td className="px-4 py-3">{formatSeconds(row.completed_seconds)}</td>
                  <td className="px-4 py-3 text-text-muted">{row.last_task_name ?? '-'}</td>
                  <td className="px-4 py-3 text-text-muted">
                    {formatDateTime(row.last_logged_at)}
                  </td>
                </tr>
              ))}
              {activeRows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-small text-text-subtle">
                    스톱워치 기록이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
