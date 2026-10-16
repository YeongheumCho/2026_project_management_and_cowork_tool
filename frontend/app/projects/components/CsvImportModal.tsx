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
import { findColumn, missingRequiredColumns } from '../lib/subprojectCsvColumns';

type ParsedRow = {
  function_name: string;
  avg_expected_minutes: number | null;
  weight: number | null;
  assignee_name: string;
  /** 내보내기는 담당자가 여러 명이면 한 칸에 쉼표로 넣는다 */
  assignee_ids: number[];
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

// 열 이름은 내보내기와 한 곳에서 공유한다 -> lib/subprojectCsvColumns.ts
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

/**
 * CSV 파일 바이트를 글자로 바꾼다.
 *
 * B-99: 엑셀의 "CSV(쉼표로 분리)" 저장이나 오래된 메모장의 기본 저장(ANSI)은
 * UTF-8 이 아니라 CP949 로 저장한다. 예전에는 UTF-8 로만 읽어서 그런 파일은
 * 한글 열 이름이 깨져 "열을 찾지 못했습니다" 로 끝났다.
 * UTF-8 로 엄격하게 읽어 보고, 깨진 바이트가 있으면 CP949(EUC-KR)로 다시 읽는다.
 */
export function decodeCsvBytes(buffer: ArrayBuffer | null | undefined): string {
  if (!buffer) return '';
  const bytes = new Uint8Array(buffer);
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('euc-kr').decode(bytes);
  }
}

export function parseCsvLine(line: string): string[] {
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
  const nameIndex = findColumn(headers, 'functionName');
  const subprojectIndex = findColumn(headers, 'subprojectName');
  const minuteIndex = findColumn(headers, 'minutes');
  const assigneeIndex = findColumn(headers, 'assignee');
  const weightIndex = findColumn(headers, 'weight');
  const levelIndex = findColumn(headers, 'level');

  return lines.slice(1).map((line) => {
    const cols = parseCsvLine(line);
    // 기능명이 비어 있으면 하위 프로젝트 이름을 쓴다.
    // 내보낸 파일에는 기능명이 빈 줄이 많아 그대로는 되돌릴 수 없었다.
    const rawFunction = nameIndex >= 0 ? (cols[nameIndex] ?? '').trim() : '';
    const rawSubproject = subprojectIndex >= 0 ? (cols[subprojectIndex] ?? '').trim() : '';
    const functionName = rawFunction || rawSubproject;
    const minutes = parseMinutes(minuteIndex >= 0 ? (cols[minuteIndex] ?? '') : '');
    const assigneeName = assigneeIndex >= 0 ? (cols[assigneeIndex] ?? '').trim() : '';
    const weightRaw = weightIndex >= 0 ? (cols[weightIndex] ?? '') : '';
    const weight = parseWeight(weightRaw);
    const levelRaw = levelIndex >= 0 ? (cols[levelIndex] ?? '') : '';
    const verificationLevel = normalizeLevel(levelRaw);
    const errors: string[] = [];

    // 담당자는 '관리자, 미분류인원' 처럼 한 칸에 여러 명이 올 수 있다
    const assigneeNames = assigneeName
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
    const assigneeIds: number[] = [];
    for (const one of assigneeNames) {
      const matches = assigneeOptions.filter((user) => user.name.trim() === one);
      if (matches.length === 1) assigneeIds.push(matches[0].id);
      else if (matches.length === 0) errors.push(`담당자 없음: ${one}`);
      else errors.push(`동명이인 담당자: ${one}`);
    }

    if (!functionName) errors.push('기능명과 하위 프로젝트 이름이 모두 비어 있음');
    // 소요 시간과 Lv 는 비어 있어도 등록할 수 있다.
    // 내보낸 파일에는 이 값이 없는 줄이 많아, 필수로 두면 되돌릴 수 없다.
    if (minuteIndex >= 0) {
      const raw = (cols[minuteIndex] ?? '').trim();
      if (raw && minutes === null) errors.push('평균 소요 시간은 1분 이상의 숫자로 입력');
    }
    if (weightRaw.trim() && weight === null) errors.push('가중치는 1~10 사이 숫자로 입력');
    if (levelRaw.trim() && verificationLevel === null) errors.push(`Lv 값 오류: ${levelRaw}`);

    return {
      function_name: functionName,
      avg_expected_minutes: minutes,
      weight,
      assignee_name: assigneeName,
      assignee_ids: assigneeIds,
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
      const text = decodeCsvBytes(ev.target?.result as ArrayBuffer);
      // 먼저 열 이름부터 본다. 자리 번호로 넘겨짚으면 엉뚱한 열을 읽고
      // "숫자로 입력하세요" 같은 엉뚱한 오류가 모든 줄에 뜬다.
      const headerLine = text.replace(/^\uFEFF/, '').split(/\r?\n/)[0] ?? '';
      const missing = missingRequiredColumns(parseCsvLine(headerLine));
      if (missing.length > 0) {
        setRows([]);
        setFileError(
          `다음 열을 찾지 못했습니다: ${missing.join(', ')}. \n`
          + '내보내기로 받은 파일을 그대로 쓰시면 열 이름이 자동으로 맞습니다.',
        );
        return;
      }
      const parsed = parseCsv(text, assigneeOptions);
      setRows(parsed);
      if (parsed.length === 0) {
        setFileError('머리글 아래에 읽을 행이 없습니다. 내용이 비어 있는지 확인해 주세요.');
      }
    };
    // 인코딩을 직접 판단하려고 글자가 아니라 바이트로 읽는다.
    reader.readAsArrayBuffer(file);
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
            assignee_ids: row.assignee_ids,
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
            기능명만 있으면 등록됩니다. 평균 소요 시간·가중치·담당자·Lv는 비워 두고 나중에 채울 수 있으며, 기간은 아래 기본값으로 일괄 적용합니다.
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
            컬럼: 기능명(또는 하위 프로젝트) / 담당자 · 평균 소요 시간·가중치·Lv 는 선택
          </p>
        </div>

        <CsvHelp />

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

/**
 * B-99: 사용 방법과 적용 예시.
 * 5층처럼 오피스·구글 시트가 없는 PC 에서도 메모장만으로 쓸 수 있다는 점을 먼저 알린다.
 */
function CsvHelp() {
  return (
    <details className="rounded-[14px] border border-border bg-white px-4 py-3 text-micro text-text-muted">
      <summary className="cursor-pointer font-semibold text-text">
        사용 방법과 예시 (엑셀이 없어도 메모장으로 됩니다)
      </summary>

      <div className="mt-3 space-y-3 leading-relaxed">
        <section>
          <p className="font-semibold text-text">가장 쉬운 방법 — 내보낸 파일을 고쳐서 다시 넣기</p>
          <ol className="mt-1 list-decimal space-y-0.5 pl-5">
            <li>프로젝트 카드의 <b>CSV 추출</b>로 파일을 받습니다.</li>
            <li>파일을 <b>메모장</b>(또는 엑셀)으로 열어 줄을 고치거나 더합니다.</li>
            <li>이 창에서 <b>CSV 파일 선택</b>으로 넣으면 미리보기가 뜹니다. 확인 후 등록합니다.</li>
          </ol>
          <p className="mt-1 text-text-subtle">
            열 이름은 그대로 두세요. 쓰지 않는 열은 비워 두거나 지워도 됩니다.
          </p>
        </section>

        <section>
          <p className="font-semibold text-text">처음부터 만들 때 — 메모장 예시</p>
          <pre className="mt-1 overflow-x-auto rounded-lg bg-surface-muted px-3 py-2 font-mono text-tiny text-text">
{`기능명,평균소요시간(분),가중치,담당자,Lv
TST+RGR,120,5,홍길동,LV2
02_Diagnosis,90,3,"김철수, 이영희",LV3
27_Signal_Interface,,,,`}
          </pre>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            <li>첫 줄은 열 이름, 다음 줄부터 한 줄에 하위 프로젝트 하나입니다.</li>
            <li><b>기능명만 필수</b>입니다. 나머지는 비워 두면 나중에 채울 수 있습니다(마지막 줄처럼).</li>
            <li>담당자가 여럿이면 큰따옴표로 묶고 쉼표로 나눕니다. 이름은 이 프로젝트 참여 인원과 같아야 합니다.</li>
            <li>Lv 는 기초검증·LV1·LV2·BSW·LV3·LV4 중 하나, 가중치는 1~10 입니다.</li>
            <li>메모장에서 저장할 때 인코딩은 UTF-8 이 기본이지만, ANSI 로 저장해도 읽힙니다.</li>
          </ul>
        </section>

        <section>
          <p className="font-semibold text-text">CSV 추출과 XLSX 추출의 차이</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            <li><b>CSV</b>: 메모장으로 열고 고칠 수 있습니다. 다시 가져오기에 쓰는 형식입니다.</li>
            <li><b>XLSX</b>: 엑셀이 있는 PC 에서 보고서·공유용으로 씁니다. 가져오기에는 쓸 수 없습니다.</li>
          </ul>
        </section>
      </div>
    </details>
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
