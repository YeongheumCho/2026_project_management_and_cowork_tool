'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  apiFetch,
  type WorkLogUserSummary,
} from '../../lib/api';

type Props = {
  enabled: boolean;
  selectedUserIds?: Set<number> | null;
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

export default function StopwatchSummaryManager({ enabled, selectedUserIds = null }: Props) {
  const [rows, setRows] = useState<WorkLogUserSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!enabled) return;
    setLoading(true);
    apiFetch<WorkLogUserSummary[]>('/work-logs/admin-summary')
      .then((next) => {
        setRows(next);
        setError('');
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [enabled]);

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

  if (!enabled) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-[#EAEAE4] bg-white p-4">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-[14px] font-bold text-[#1A1A1A]">
            스톱워치 시간 현황
          </h3>
          <p className="mt-1 text-[12px] text-[#888780]">
            구성원별 스톱워치 누적 시간과 현재 진행 중인 기록을 확인합니다.
          </p>
        </div>
        <div className="flex gap-2 text-[12px]">
          <span className="rounded-lg bg-[#F1EEFB] px-3 py-2 font-semibold text-[#534AB7]">
            누적 {formatSeconds(totalSeconds)}
          </span>
          <span className="rounded-lg bg-[#EAF8F0] px-3 py-2 font-semibold text-[#1D7A47]">
            진행 중 {runningCount}건
          </span>
        </div>
      </div>

      {error && (
        <p className="mb-3 rounded-lg bg-[#FFF4F4] px-3 py-2 text-[12px] text-[#A32D2D]">
          {error}
        </p>
      )}
      {loading && (
        <p className="rounded-xl bg-[#FAFAFA] px-4 py-5 text-center text-[12px] text-[#888780]">
          스톱워치 기록을 불러오는 중입니다.
        </p>
      )}
      {!loading && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead className="bg-[#FAFAFA] text-[12px] text-[#888780]">
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
                <tr key={row.user_id} className="border-t border-[#EAEAE4] text-[#1A1A1A]">
                  <td className="px-4 py-3 font-semibold">{row.user_name}</td>
                  <td className="px-4 py-3 text-[#5F5E5A]">
                    {[row.center, row.office, row.team].filter(Boolean).join(' / ') || '-'}
                  </td>
                  <td className="px-4 py-3">{formatSeconds(row.total_seconds)}</td>
                  <td className="px-4 py-3 text-[#1D7A47]">
                    {formatSeconds(row.running_seconds)}
                  </td>
                  <td className="px-4 py-3">{formatSeconds(row.paused_seconds)}</td>
                  <td className="px-4 py-3">{formatSeconds(row.completed_seconds)}</td>
                  <td className="px-4 py-3 text-[#5F5E5A]">{row.last_task_name ?? '-'}</td>
                  <td className="px-4 py-3 text-[#5F5E5A]">
                    {formatDateTime(row.last_logged_at)}
                  </td>
                </tr>
              ))}
              {activeRows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-[12px] text-[#888780]">
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
