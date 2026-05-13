'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Modal from '../../components/Modal';
import { apiFetch, type Project, type SubProject, type UserBrief } from '../../lib/api';
import { clampDateYear, MAX_DATE_VALUE } from '../../lib/dateInput';

type ParsedRow = {
  function_name: string;
  avg_expected_minutes: number | null;
  error: string | null;
};

type ResultRow = ParsedRow & { status: 'ok' | 'error'; detail: string };

type Props = {
  open: boolean;
  project: Project | null;
  users: UserBrief[];
  onClose: () => void;
  onImported: () => Promise<void>;
};

const FUNCTION_HEADERS = ['기능명', '검증기능', '검증 기능', 'function_name', 'function', 'name'];
const MINUTE_HEADERS = [
  '평균소요시간(분)',
  '평균 소요 시간(분)',
  '평균소요시간',
  '평균 소요 시간',
  '평균소요',
  'avg_expected_minutes',
  'minutes',
];

function parseCsvLine(line: string): string[] {
  const cols: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    const next = line[i + 1];

    if (ch === '"' && inQuotes && next === '"') {
      current += '"';
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === ',' && !inQuotes) {
      cols.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }

  cols.push(current.trim());
  return cols;
}

function normalizeHeader(value: string): string {
  return value.replace(/^\uFEFF/, '').replace(/\s+/g, '').toLowerCase();
}

function findHeaderIndex(headers: string[], aliases: string[]): number {
  const normalizedAliases = aliases.map(normalizeHeader);
  return headers.findIndex((header) => normalizedAliases.includes(normalizeHeader(header)));
}

function parseMinutes(raw: string): number | null {
  const normalized = raw.trim().replace(/분$/, '');
  if (!normalized) return null;

  const value = Number(normalized);
  if (!Number.isFinite(value) || value <= 0 || !Number.isInteger(value)) return null;
  return value;
}

function parseCsv(text: string): ParsedRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]);
  const functionIndex = findHeaderIndex(headers, FUNCTION_HEADERS);
  const minuteIndex = findHeaderIndex(headers, MINUTE_HEADERS);

  return lines.slice(1).map((line) => {
    const cols = parseCsvLine(line);
    const functionName = (cols[functionIndex >= 0 ? functionIndex : 0] ?? '').trim();
    const minutes = parseMinutes(cols[minuteIndex >= 0 ? minuteIndex : 1] ?? '');

    const errors: string[] = [];
    if (!functionName) errors.push('기능명 누락');
    if (minutes === null) errors.push('평균 소요 시간은 1분 이상의 정수로 입력');

    return {
      function_name: functionName,
      avg_expected_minutes: minutes,
      error: errors.length > 0 ? errors.join(', ') : null,
    };
  });
}

function formatPerson(user: UserBrief): string {
  return [user.name, user.position, user.team].filter(Boolean).join(' · ');
}

export default function CsvImportModal({
  open,
  project,
  users,
  onClose,
  onImported,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [results, setResults] = useState<ResultRow[] | null>(null);
  const [importing, setImporting] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [defaultAssigneeId, setDefaultAssigneeId] = useState<number | ''>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const assigneeOptions = useMemo(() => {
    const participants = project?.participants ?? [];
    return participants.length > 0 ? participants : users;
  }, [project?.participants, users]);

  const defaultAssignee = assigneeOptions.find((user) => user.id === defaultAssigneeId) ?? null;
  const validRows = rows.filter((row) => row.error === null);
  const invalidRows = rows.filter((row) => row.error !== null);
  const hasInvalidDefaults =
    !project ||
    defaultAssigneeId === '' ||
    !startDate ||
    !endDate ||
    endDate < startDate;
  const canImport = validRows.length > 0 && !hasInvalidDefaults && !importing;

  useEffect(() => {
    if (!open) return;

    const firstAssignee = (project?.participants?.length ? project.participants : users)[0];
    setDefaultAssigneeId(firstAssignee?.id ?? '');
    setStartDate(project?.start_date ?? '');
    setEndDate(project?.end_date ?? '');
  }, [open, project, users]);

  const handleFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setFileError('CSV 파일(.csv)만 지원합니다.');
      return;
    }

    setFileError(null);
    setResults(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = (ev.target?.result as string) ?? '';
      const parsed = parseCsv(text);
      setRows(parsed);
      if (parsed.length === 0) {
        setFileError('불러올 행이 없습니다. 기능명과 평균소요시간(분) 컬럼을 확인해주세요.');
      }
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleImport = async () => {
    if (!project || !canImport) return;
    const assigneeId = Number(defaultAssigneeId);

    setImporting(true);
    const resultList: ResultRow[] = [];

    for (const row of rows) {
      if (row.error) {
        resultList.push({ ...row, status: 'error', detail: row.error });
        continue;
      }

      try {
        await apiFetch<SubProject>('/subprojects', {
          method: 'POST',
          body: JSON.stringify({
            project_id: project.id,
            name: row.function_name,
            function_name: row.function_name,
            avg_expected_minutes: row.avg_expected_minutes,
            start_date: startDate,
            end_date: endDate,
            assignee_ids: [assigneeId],
          }),
        });
        resultList.push({ ...row, status: 'ok', detail: '등록 완료' });
      } catch (err) {
        resultList.push({
          ...row,
          status: 'error',
          detail: (err as Error).message ?? '등록 실패',
        });
      }
    }

    setResults(resultList);
    setImporting(false);

    if (resultList.some((row) => row.status === 'ok')) {
      await onImported();
    }
  };

  const handleClose = () => {
    setRows([]);
    setResults(null);
    setFileError(null);
    setDefaultAssigneeId('');
    setStartDate('');
    setEndDate('');
    if (fileRef.current) fileRef.current.value = '';
    onClose();
  };

  const downloadSample = () => {
    const csv = '\uFEFF기능명,평균소요시간(분)\nTST+RGR,120\n02_Diagnosis,90\n';
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '검증기능_평균소요시간_일괄등록.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Modal open={open} onClose={handleClose} size="lg">
      <div className="space-y-4">
        <div>
          <h2 className="text-heading font-bold tracking-[-0.2px] text-[#1A1A1A]">
            CSV로 검증 기능 일괄 등록
          </h2>
          <p className="mt-1 text-micro text-[#888780]">
            CSV에는 검증할 기능명과 평균 소요 시간만 입력하고, 담당자와 기간은 아래 기본값으로 일괄 적용합니다.
          </p>
        </div>

        <div className="grid gap-3 rounded-[14px] border border-[#EAEAE4] bg-[#FAFAF7] p-4 md:grid-cols-[1.4fr_1fr_1fr]">
          <label className="block text-micro font-semibold text-[#5F5E5A]">
            기본 담당자
            <select
              value={defaultAssigneeId}
              onChange={(event) => setDefaultAssigneeId(Number(event.target.value))}
              className="mt-1 h-9 w-full rounded-[10px] border border-[#DDDAD0] bg-white px-3 text-small text-[#1A1A1A] outline-none focus:border-[#534AB7]"
            >
              {assigneeOptions.length === 0 ? (
                <option value="">선택 가능한 담당자 없음</option>
              ) : (
                assigneeOptions.map((user) => (
                  <option key={user.id} value={user.id}>
                    {formatPerson(user)}
                  </option>
                ))
              )}
            </select>
          </label>

          <label className="block text-micro font-semibold text-[#5F5E5A]">
            기본 시작일
            <input
              type="date"
              value={startDate}
              max={MAX_DATE_VALUE}
              onChange={(event) => setStartDate(clampDateYear(event.target.value))}
              className="mt-1 h-9 w-full rounded-[10px] border border-[#DDDAD0] bg-white px-3 text-small text-[#1A1A1A] outline-none focus:border-[#534AB7]"
            />
          </label>

          <label className="block text-micro font-semibold text-[#5F5E5A]">
            기본 종료일
            <input
              type="date"
              value={endDate}
              max={MAX_DATE_VALUE}
              onChange={(event) => setEndDate(clampDateYear(event.target.value))}
              className="mt-1 h-9 w-full rounded-[10px] border border-[#DDDAD0] bg-white px-3 text-small text-[#1A1A1A] outline-none focus:border-[#534AB7]"
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-[12px] border border-[#DDDAD0] bg-white px-4 py-2 text-small font-semibold text-[#1A1A1A] hover:bg-[#FAFAF7]">
            <svg
              className="h-4 w-4 text-[#534AB7]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M16 10l-4-4m0 0L8 10m4-4v12"
              />
            </svg>
            CSV 파일 선택
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              className="sr-only"
              onChange={handleFile}
            />
          </label>

          <button
            type="button"
            onClick={downloadSample}
            className="text-micro font-medium text-[#534AB7] underline underline-offset-2 hover:text-[#473EA7]"
          >
            양식 다운로드
          </button>

          <p className="text-micro text-[#888780]">컬럼: 기능명 / 평균소요시간(분)</p>
        </div>

        {fileError && <p className="text-small text-[#A32D2D]">{fileError}</p>}

        {hasInvalidDefaults && (
          <p className="rounded-[12px] bg-[#FFF7E8] px-4 py-2 text-micro text-[#9A6400]">
            기본 담당자와 시작일, 종료일을 확인해야 일괄 등록할 수 있습니다.
          </p>
        )}

        {rows.length > 0 && !results && (
          <>
            <div className="rounded-[14px] border border-[#EAEAE4] bg-[#FAFAF7] px-4 py-2.5 text-micro text-[#5F5E5A]">
              총 <strong>{rows.length}</strong>행 파싱 ·{' '}
              <span className="text-[#0F6E56]">유효 {validRows.length}건</span>
              {invalidRows.length > 0 && (
                <span className="ml-2 text-[#A32D2D]">오류 {invalidRows.length}건</span>
              )}
            </div>

            <div className="max-h-[280px] overflow-auto rounded-[14px] border border-[#EAEAE4]">
              <table className="w-full text-left text-micro">
                <thead className="sticky top-0 bg-[#F4F4F0]">
                  <tr>
                    <th className="px-3 py-2 font-semibold text-[#5F5E5A]">#</th>
                    <th className="px-3 py-2 font-semibold text-[#5F5E5A]">검증 기능</th>
                    <th className="px-3 py-2 font-semibold text-[#5F5E5A]">평균 소요(분)</th>
                    <th className="px-3 py-2 font-semibold text-[#5F5E5A]">기본 담당자</th>
                    <th className="px-3 py-2 font-semibold text-[#5F5E5A]">기간</th>
                    <th className="px-3 py-2 font-semibold text-[#5F5E5A]">상태</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0EEE7] bg-white">
                  {rows.map((row, index) => (
                    <tr key={`${row.function_name}-${index}`} className={row.error ? 'bg-[#FFF7F7]' : ''}>
                      <td className="px-3 py-2 text-[#888780]">{index + 1}</td>
                      <td className="px-3 py-2 font-medium text-[#1A1A1A]">
                        {row.function_name || '-'}
                      </td>
                      <td className="px-3 py-2 text-[#5F5E5A]">
                        {row.avg_expected_minutes ?? '-'}
                      </td>
                      <td className="px-3 py-2 text-[#5F5E5A]">
                        {defaultAssignee?.name ?? '-'}
                      </td>
                      <td className="px-3 py-2 text-[#5F5E5A]">
                        {startDate && endDate ? `${startDate} ~ ${endDate}` : '-'}
                      </td>
                      <td className="px-3 py-2">
                        {row.error ? (
                          <span className="text-[#A32D2D]">{row.error}</span>
                        ) : (
                          <span className="text-[#0F6E56]">정상</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {validRows.length > 0 && (
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="rounded-[12px] border border-[#DDDAD0] px-4 py-2 text-small font-semibold text-[#5F5E5A] hover:bg-[#F4F4F0]"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={() => void handleImport()}
                  disabled={!canImport}
                  className="rounded-[12px] bg-[#534AB7] px-5 py-2 text-small font-bold text-white shadow-[0_4px_12px_rgba(83,74,183,0.24)] hover:bg-[#473EA7] disabled:opacity-50"
                >
                  {importing ? '등록 중...' : `${validRows.length}건 일괄 등록`}
                </button>
              </div>
            )}
          </>
        )}

        {results && (
          <>
            <div className="rounded-[14px] border border-[#EAEAE4] bg-[#FAFAF7] px-4 py-2.5 text-micro text-[#5F5E5A]">
              등록 완료:{' '}
              <span className="text-[#0F6E56]">
                {results.filter((row) => row.status === 'ok').length}건
              </span>
              {results.some((row) => row.status === 'error') && (
                <>
                  {' / '}
                  <span className="text-[#A32D2D]">
                    실패 {results.filter((row) => row.status === 'error').length}건
                  </span>
                </>
              )}
            </div>

            <div className="max-h-[280px] overflow-auto rounded-[14px] border border-[#EAEAE4]">
              <table className="w-full text-left text-micro">
                <thead className="sticky top-0 bg-[#F4F4F0]">
                  <tr>
                    <th className="px-3 py-2 font-semibold text-[#5F5E5A]">#</th>
                    <th className="px-3 py-2 font-semibold text-[#5F5E5A]">검증 기능</th>
                    <th className="px-3 py-2 font-semibold text-[#5F5E5A]">평균 소요(분)</th>
                    <th className="px-3 py-2 font-semibold text-[#5F5E5A]">결과</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0EEE7] bg-white">
                  {results.map((row, index) => (
                    <tr key={`${row.function_name}-${index}`} className={row.status === 'error' ? 'bg-[#FFF7F7]' : ''}>
                      <td className="px-3 py-2 text-[#888780]">{index + 1}</td>
                      <td className="px-3 py-2 font-medium text-[#1A1A1A]">
                        {row.function_name || '-'}
                      </td>
                      <td className="px-3 py-2 text-[#5F5E5A]">
                        {row.avg_expected_minutes ?? '-'}
                      </td>
                      <td className="px-3 py-2">
                        {row.status === 'ok' ? (
                          <span className="text-[#0F6E56]">{row.detail}</span>
                        ) : (
                          <span className="text-[#A32D2D]">{row.detail}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleClose}
                className="rounded-[12px] bg-[#534AB7] px-5 py-2 text-small font-bold text-white hover:bg-[#473EA7]"
              >
                닫기
              </button>
            </div>
          </>
        )}

        {rows.length === 0 && !fileError && (
          <p className="rounded-[14px] border border-dashed border-[#D7D4CA] px-5 py-8 text-center text-small text-[#8B897F]">
            CSV 파일을 선택하면 검증 기능 목록을 미리볼 수 있습니다.
          </p>
        )}
      </div>
    </Modal>
  );
}
