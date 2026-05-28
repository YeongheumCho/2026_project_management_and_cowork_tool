'use client';

import { type ChangeEvent, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import Modal from '../../components/Modal';
import {
  apiFetch,
  type Project,
  type SubProject,
  type UserBrief,
  type VerificationLevel,
} from '../../lib/api';
import { clampDateYear, MAX_DATE_VALUE } from '../../lib/dateInput';

type ParsedRow = {
  function_name: string;
  avg_expected_minutes: number | null;
  weight: number | null;
  assignee_name: string;
  assignee_id: number | null;
  verification_level: VerificationLevel | null;
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
const ASSIGNEE_HEADERS = ['담당자', '담당자명', 'assignee', 'assignee_name'];
const WEIGHT_HEADERS = ['가중치', 'weight'];
const LEVEL_HEADERS = [
  'Lv',
  'LV',
  'level',
  '검증Lv',
  '검증LV',
  '검증Level',
  '검증LEVEL',
  'verification_level',
];
const LEVEL_ALIASES: Record<string, VerificationLevel> = {
  basic: 'basic',
  기초: 'basic',
  기초검증: 'basic',
  lv1: 'LV1',
  lv2: 'LV2',
  bsw: 'BSW',
  lv3: 'LV3',
  lv4: 'LV4',
};

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
  const normalized = raw.trim().replace(/분/g, '').replace(/,/g, '');
  if (!normalized) return null;
  const value = Number(normalized);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value);
}

function parseWeight(raw: string): number | null {
  const normalized = raw.trim();
  if (!normalized) return null;
  const value = Number(normalized);
  if (!Number.isFinite(value) || value < 1 || value > 10) return null;
  return Math.round(value);
}

function normalizeLevel(raw: string): VerificationLevel | null {
  const key = raw.trim().replace(/\s+/g, '').toLowerCase();
  if (!key) return null;
  return LEVEL_ALIASES[key] ?? null;
}

function parseCsv(text: string, assigneeOptions: UserBrief[]): ParsedRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]);
  const functionIndex = findHeaderIndex(headers, FUNCTION_HEADERS);
  const minuteIndex = findHeaderIndex(headers, MINUTE_HEADERS);
  const assigneeIndex = findHeaderIndex(headers, ASSIGNEE_HEADERS);
  const weightIndex = findHeaderIndex(headers, WEIGHT_HEADERS);
  const levelIndex = findHeaderIndex(headers, LEVEL_HEADERS);

  return lines.slice(1).map((line) => {
    const cols = parseCsvLine(line);
    const functionName = (cols[functionIndex >= 0 ? functionIndex : 0] ?? '').trim();
    const minutes = parseMinutes(cols[minuteIndex >= 0 ? minuteIndex : 1] ?? '');
    const assigneeName = (cols[assigneeIndex >= 0 ? assigneeIndex : 2] ?? '').trim();
    const weightRaw = weightIndex >= 0 ? (cols[weightIndex] ?? '') : '';
    const weight = parseWeight(weightRaw);
    const levelRaw = cols[levelIndex >= 0 ? levelIndex : 3] ?? '';
    const assigneeMatches = assigneeOptions.filter((user) => user.name.trim() === assigneeName);
    const verificationLevel = normalizeLevel(levelRaw);
    const errors: string[] = [];

    if (!functionName) errors.push('기능명 누락');
    if (minutes === null) errors.push('평균 소요 시간은 1분 이상의 숫자로 입력');
    if (weightRaw.trim() && weight === null) errors.push('가중치는 1~10 사이 숫자로 입력');
    if (!assigneeName) errors.push('담당자 누락');
    else if (assigneeMatches.length === 0) errors.push(`담당자 없음: ${assigneeName}`);
    else if (assigneeMatches.length > 1) errors.push(`동명이인 담당자: ${assigneeName}`);
    if (!levelRaw.trim()) errors.push('Lv 누락');
    else if (verificationLevel === null) errors.push(`Lv 값 오류: ${levelRaw}`);

    return {
      function_name: functionName,
      avg_expected_minutes: minutes,
      weight,
      assignee_name: assigneeName,
      assignee_id: assigneeMatches.length === 1 ? assigneeMatches[0].id : null,
      verification_level: verificationLevel,
      error: errors.length > 0 ? errors.join(', ') : null,
    };
  });
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
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const assigneeOptions = useMemo(() => {
    const participants = project?.participants ?? [];
    return participants.length > 0 ? participants : users;
  }, [project?.participants, users]);

  const validRows = rows.filter((row) => row.error === null);
  const invalidRows = rows.filter((row) => row.error !== null);
  const hasInvalidDefaults = !project || !startDate || !endDate || endDate < startDate;
  const canImport = validRows.length > 0 && !hasInvalidDefaults && !importing;

  useEffect(() => {
    if (!open) return;
    setStartDate(project?.start_date ?? '');
    setEndDate(project?.end_date ?? '');
  }, [open, project, users]);

  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
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
      const parsed = parseCsv(text, assigneeOptions);
      setRows(parsed);
      if (parsed.length === 0) {
        setFileError('불러온 행이 없습니다. 기능명, 평균소요시간(분), 가중치, 담당자, Lv 컬럼을 확인해주세요.');
      }
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleImport = async () => {
    if (!project || !canImport) return;
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
            ...(row.weight === null ? {} : { weight: row.weight }),
            verification_level: row.verification_level,
            start_date: startDate,
            end_date: endDate,
            assignee_ids: row.assignee_id === null ? [] : [row.assignee_id],
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
    setStartDate('');
    setEndDate('');
    if (fileRef.current) fileRef.current.value = '';
    onClose();
  };

  const downloadSample = () => {
    const csv = '\uFEFF기능명,평균소요시간(분),가중치,담당자,Lv\nTST+RGR,120,5,홍길동,LV2\n02_Diagnosis,90,3,김철수,LV3\n';
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '검증기능_담당자_Lv_일괄등록.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Modal open={open} onClose={handleClose} size="lg">
      <div className="space-y-4">
        <div>
          <h2 className="text-heading font-bold tracking-[-0.2px] text-text">
            CSV로 검증 기능 일괄 등록
          </h2>
          <p className="mt-1 text-micro text-text-subtle">
            CSV에는 검증할 기능명, 평균 소요 시간, 가중치, 담당자, Lv를 입력하고 기간은 아래 기본값으로 일괄 적용합니다.
          </p>
        </div>

        <div className="grid gap-3 rounded-[14px] border border-border bg-surface-muted p-4 md:grid-cols-2">
          <DateField label="기본 시작일" value={startDate} onChange={setStartDate} />
          <DateField label="기본 종료일" value={endDate} onChange={setEndDate} />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-[12px] border border-border-strong bg-white px-4 py-2 text-small font-semibold text-text hover:bg-surface-muted">
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
            className="text-micro font-medium text-brand underline underline-offset-2 hover:text-brand-hover"
          >
            양식 다운로드
          </button>
          <p className="text-micro text-text-subtle">
            컬럼: 기능명 / 평균소요시간(분) / 가중치(선택) / 담당자 / Lv
          </p>
        </div>

        {fileError && <p className="text-small text-verify-fail-fg">{fileError}</p>}

        {hasInvalidDefaults && (
          <p className="rounded-[12px] bg-verify-warn-bg px-4 py-2 text-micro text-verify-warn-fg">
            시작일과 종료일을 확인해야 일괄 등록할 수 있습니다.
          </p>
        )}

        {rows.length > 0 && !results && (
          <>
            <ImportSummary total={rows.length} valid={validRows.length} invalid={invalidRows.length} />
            <PreviewTable
              rows={rows}
              period={startDate && endDate ? `${startDate} ~ ${endDate}` : '-'}
            />
            {validRows.length > 0 && (
              <div className="flex justify-end gap-2">
                <SecondaryButton onClick={handleClose}>취소</SecondaryButton>
                <button
                  type="button"
                  onClick={() => void handleImport()}
                  disabled={!canImport}
                  className="rounded-[12px] bg-brand px-5 py-2 text-small font-bold text-white shadow-[0_4px_12px_rgba(0,72,255,0.24)] hover:bg-brand-hover disabled:opacity-50"
                >
                  {importing ? '등록 중...' : `${validRows.length}건 일괄 등록`}
                </button>
              </div>
            )}
          </>
        )}

        {results && (
          <>
            <ResultSummary results={results} />
            <ResultTable results={results} />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleClose}
                className="rounded-[12px] bg-brand px-5 py-2 text-small font-bold text-white hover:bg-brand-hover"
              >
                닫기
              </button>
            </div>
          </>
        )}

        {rows.length === 0 && !fileError && (
          <p className="rounded-[14px] border border-dashed border-border-strong px-5 py-8 text-center text-small text-text-subtle">
            CSV 파일을 선택하면 검증 기능 목록을 미리볼 수 있습니다.
          </p>
        )}
      </div>
    </Modal>
  );
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-micro font-semibold text-text-muted">
      {label}
      <input
        type="date"
        value={value}
        max={MAX_DATE_VALUE}
        onChange={(event) => onChange(clampDateYear(event.target.value))}
        className="mt-1 h-9 w-full rounded-[10px] border border-border-strong bg-white px-3 text-small text-text outline-none focus:border-brand"
      />
    </label>
  );
}

function ImportSummary({ total, valid, invalid }: { total: number; valid: number; invalid: number }) {
  return (
    <div className="rounded-[14px] border border-border bg-surface-muted px-4 py-2.5 text-micro text-text-muted">
      총 <strong>{total}</strong>개 행 · <span className="text-verify-pass-fg">유효 {valid}건</span>
      {invalid > 0 && <span className="ml-2 text-verify-fail-fg">오류 {invalid}건</span>}
    </div>
  );
}

function PreviewTable({
  rows,
  period,
}: {
  rows: ParsedRow[];
  period: string;
}) {
  return (
    <div className="max-h-[280px] overflow-auto rounded-[14px] border border-border">
      <table className="w-full text-left text-micro">
        <thead className="sticky top-0 bg-surface-subtle">
          <tr>
            <TableHead>#</TableHead>
            <TableHead>검증 기능</TableHead>
            <TableHead>평균 소요(분)</TableHead>
            <TableHead>가중치</TableHead>
            <TableHead>담당자</TableHead>
            <TableHead>Lv</TableHead>
            <TableHead>기간</TableHead>
            <TableHead>상태</TableHead>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-subtle bg-white">
          {rows.map((row, index) => (
            <tr key={`${row.function_name}-${index}`} className={row.error ? 'bg-verify-fail-bg' : ''}>
              <TableCell muted>{index + 1}</TableCell>
              <TableCell strong>{row.function_name || '-'}</TableCell>
              <TableCell>{row.avg_expected_minutes ?? '-'}</TableCell>
              <TableCell>{row.weight ?? '-'}</TableCell>
              <TableCell>{row.assignee_name || '-'}</TableCell>
              <TableCell>{row.verification_level ?? '-'}</TableCell>
              <TableCell>{period}</TableCell>
              <TableCell>
                {row.error ? (
                  <span className="text-verify-fail-fg">{row.error}</span>
                ) : (
                  <span className="text-verify-pass-fg">정상</span>
                )}
              </TableCell>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ResultSummary({ results }: { results: ResultRow[] }) {
  const ok = results.filter((row) => row.status === 'ok').length;
  const failed = results.length - ok;
  return (
    <div className="rounded-[14px] border border-border bg-surface-muted px-4 py-2.5 text-micro text-text-muted">
      등록 완료: <span className="text-verify-pass-fg">{ok}건</span>
      {failed > 0 && <span className="text-verify-fail-fg"> / 실패 {failed}건</span>}
    </div>
  );
}

function ResultTable({ results }: { results: ResultRow[] }) {
  return (
    <div className="max-h-[280px] overflow-auto rounded-[14px] border border-border">
      <table className="w-full text-left text-micro">
        <thead className="sticky top-0 bg-surface-subtle">
          <tr>
            <TableHead>#</TableHead>
            <TableHead>검증 기능</TableHead>
            <TableHead>평균 소요(분)</TableHead>
            <TableHead>가중치</TableHead>
            <TableHead>담당자</TableHead>
            <TableHead>Lv</TableHead>
            <TableHead>결과</TableHead>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-subtle bg-white">
          {results.map((row, index) => (
            <tr key={`${row.function_name}-${index}`} className={row.status === 'error' ? 'bg-verify-fail-bg' : ''}>
              <TableCell muted>{index + 1}</TableCell>
              <TableCell strong>{row.function_name || '-'}</TableCell>
              <TableCell>{row.avg_expected_minutes ?? '-'}</TableCell>
              <TableCell>{row.weight ?? '-'}</TableCell>
              <TableCell>{row.assignee_name || '-'}</TableCell>
              <TableCell>{row.verification_level ?? '-'}</TableCell>
              <TableCell>
                {row.status === 'ok' ? (
                  <span className="text-verify-pass-fg">{row.detail}</span>
                ) : (
                  <span className="text-verify-fail-fg">{row.detail}</span>
                )}
              </TableCell>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TableHead({ children }: { children: ReactNode }) {
  return <th className="px-3 py-2 font-semibold text-text-muted">{children}</th>;
}

function TableCell({
  children,
  strong = false,
  muted = false,
}: {
  children: ReactNode;
  strong?: boolean;
  muted?: boolean;
}) {
  const cls = strong
    ? 'px-3 py-2 font-medium text-text'
    : muted
      ? 'px-3 py-2 text-text-subtle'
      : 'px-3 py-2 text-text-muted';
  return <td className={cls}>{children}</td>;
}

function SecondaryButton({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-[12px] border border-border-strong px-4 py-2 text-small font-semibold text-text-muted hover:bg-surface-subtle"
    >
      {children}
    </button>
  );
}
