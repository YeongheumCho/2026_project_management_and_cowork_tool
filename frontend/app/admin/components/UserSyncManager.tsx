'use client';

import { useMemo, useRef, useState } from 'react';
import InlineMessage, { type MessageTone } from '../../components/InlineMessage';
import { apiFetch } from '../../lib/api';
import { buildOrgExtractScript } from '../lib/orgExtractScript';

/**
 * 그룹웨어 조직도 CSV 로 사용자 정보를 맞춘다.
 *
 * 사번이 키다. 목록에 없는 사람은 지우지 않고 비활성으로 돌린다.
 * 계정을 지우면 그 사람 이름으로 남은 프로젝트와 수행 이력의 담당자가 비기 때문이다.
 */

type SyncChange = { idnum: string; name: string; detail?: string };

type SyncResult = {
  dry_run: boolean;
  total_rows: number;
  created: SyncChange[];
  updated: SyncChange[];
  deactivated: SyncChange[];
  reactivated: SyncChange[];
  idnum_fixed: SyncChange[];
  admin_skipped: SyncChange[];
  unchanged: number;
  errors: string[];
};

type SyncRow = {
  idnum: string;
  name: string;
  center?: string | null;
  office?: string | null;
  team?: string | null;
  position?: string | null;
  email?: string | null;
  phone?: string | null;
};

const REQUIRED_HEADERS = ['idnum', 'name'];
const KNOWN_HEADERS = [
  'idnum',
  'name',
  'center',
  'office',
  'team',
  'position',
  'email',
  'phone',
];

/** 따옴표로 감싼 칸을 고려한 한 줄 파서 */
function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      cells.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  cells.push(cur);
  return cells.map((cell) => cell.trim());
}

function parseCsv(text: string): { rows: SyncRow[]; problems: string[] } {
  const problems: string[] = [];
  const lines = text
    .replace(/^﻿/, '')
    .split(/\r?\n/)
    .filter((line) => line.trim() !== '');
  if (lines.length === 0) return { rows: [], problems: ['빈 파일입니다.'] };

  const headers = splitCsvLine(lines[0]).map((header) => header.toLowerCase());
  for (const required of REQUIRED_HEADERS) {
    if (!headers.includes(required)) {
      problems.push(`필수 열 "${required}" 이(가) 없습니다.`);
    }
  }
  const unknown = headers.filter((header) => !KNOWN_HEADERS.includes(header));
  if (unknown.length > 0) {
    problems.push(`알 수 없는 열은 무시합니다: ${unknown.join(', ')}`);
  }
  if (problems.some((problem) => problem.startsWith('필수 열'))) {
    return { rows: [], problems };
  }

  const rows: SyncRow[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cells = splitCsvLine(lines[i]);
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      record[header] = cells[index] ?? '';
    });
    if (!record.idnum || !record.name) {
      problems.push(`${i + 1}번째 줄: 사번이나 이름이 비어 있어 건너뜁니다.`);
      continue;
    }
    rows.push({
      idnum: record.idnum,
      name: record.name,
      center: record.center || null,
      office: record.office || null,
      team: record.team || null,
      position: record.position || null,
      email: record.email || null,
      phone: record.phone || null,
    });
  }
  return { rows, problems };
}

function ChangeList({
  title,
  items,
  tone,
}: {
  title: string;
  items: SyncChange[];
  tone: 'pass' | 'info' | 'fail' | 'warn' | 'idle';
}) {
  if (items.length === 0) return null;
  const toneClass = {
    pass: 'bg-verify-pass-bg text-verify-pass-fg',
    info: 'bg-verify-info-bg text-verify-info-fg',
    fail: 'bg-verify-fail-bg text-verify-fail-fg',
    warn: 'bg-verify-warn-bg text-verify-warn-fg',
    idle: 'bg-verify-idle-bg text-verify-idle-fg',
  }[tone];
  return (
    <section className="rounded-xl border border-border bg-surface">
      <header className="flex items-center gap-2 border-b border-border px-3 py-2">
        <span className={`rounded-full px-2 py-0.5 text-tiny font-bold ${toneClass}`}>
          {items.length}명
        </span>
        <h4 className="text-small font-semibold text-text">{title}</h4>
      </header>
      <ul className="max-h-[220px] overflow-y-auto px-3 py-2">
        {items.map((item) => (
          <li key={`${title}-${item.idnum}`} className="py-1 text-micro text-text-muted">
            <span className="font-semibold text-text">{item.name}</span>
            <span className="ml-1 text-text-subtle">{item.idnum}</span>
            {item.detail && <span className="ml-2">{item.detail}</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function UserSyncManager({ enabled }: { enabled: boolean }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<SyncRow[]>([]);
  const [problems, setProblems] = useState<string[]>([]);
  const [preview, setPreview] = useState<SyncResult | null>(null);
  const [applied, setApplied] = useState<SyncResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [tone, setTone] = useState<MessageTone>('info');
  const [deactivateMissing, setDeactivateMissing] = useState(true);
  const [limitCenter, setLimitCenter] = useState('');
  const [guideOpen, setGuideOpen] = useState(false);
  const [scriptCenter, setScriptCenter] = useState('E-모빌리티센터');
  const [copied, setCopied] = useState(false);

  // 파일에 센터가 한 종류만 있으면 그 센터로 비활성 범위를 제한하도록 권한다.
  const centersInFile = useMemo(
    () => [...new Set(rows.map((row) => row.center).filter(Boolean))] as string[],
    [rows],
  );

  function onPick(file: File | null) {
    setPreview(null);
    setApplied(null);
    setMessage('');
    if (!file) {
      setFileName('');
      setRows([]);
      setProblems([]);
      return;
    }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseCsv(String(reader.result ?? ''));
      setRows(parsed.rows);
      setProblems(parsed.problems);
      if (parsed.rows.length === 0) {
        setTone('error');
        setMessage('읽을 수 있는 줄이 없습니다. 열 이름을 확인해 주세요.');
      } else {
        setTone('info');
        setMessage(`${parsed.rows.length}명을 읽었습니다. 미리보기로 무엇이 바뀌는지 확인하세요.`);
        if (parsed.rows.length > 0) {
          const centers = [...new Set(parsed.rows.map((row) => row.center).filter(Boolean))];
          if (centers.length === 1) setLimitCenter(centers[0] as string);
        }
      }
    };
    reader.onerror = () => {
      setTone('error');
      setMessage('파일을 읽지 못했습니다.');
    };
    reader.readAsText(file, 'utf-8');
  }

  async function run(dryRun: boolean) {
    if (rows.length === 0) return;
    setBusy(true);
    setMessage('');
    try {
      const result = await apiFetch<SyncResult>('/auth/users/sync', {
        method: 'POST',
        body: JSON.stringify({
          rows,
          dry_run: dryRun,
          deactivate_missing: deactivateMissing,
          limit_center: limitCenter || null,
        }),
      });
      if (dryRun) {
        setPreview(result);
        setApplied(null);
        setTone('info');
        setMessage('미리보기입니다. 아직 저장하지 않았습니다.');
      } else {
        setApplied(result);
        setPreview(null);
        setTone('success');
        setMessage('반영했습니다.');
      }
    } catch (error) {
      setTone('error');
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!enabled) return null;

  const shown = applied ?? preview;

  return (
    <section className="rounded-2xl border border-border bg-surface p-5">
      <header className="mb-4">
        <h2 className="text-heading font-bold text-text">인원 동기화</h2>
        <p className="mt-1 text-small text-text-muted">
          그룹웨어 조직도를 CSV 로 내려받아 올리면 소속과 직급을 맞춥니다. 사번이 기준입니다.
          목록에 없는 사람은 지우지 않고 비활성으로 돌립니다. 권한과 비밀번호는 바뀌지 않습니다.
        </p>
        <p className="mt-1 text-micro text-text-subtle">
          열 이름: idnum, name, center, office, team, position, email, phone (앞의 둘은 필수)
        </p>
      </header>

      <details
        open={guideOpen}
        onToggle={(event) => setGuideOpen((event.target as HTMLDetailsElement).open)}
        className="mb-4 rounded-xl border border-border bg-surface-muted"
      >
        <summary className="cursor-pointer px-4 py-3 text-small font-semibold text-text">
          그룹웨어에서 CSV 받는 방법
        </summary>
        <div className="border-t border-border px-4 py-3">
          <ol className="list-decimal space-y-1.5 pl-5 text-small text-text-muted">
            <li>
              그룹웨어(<span className="text-text">gw.suresofttech.com</span>)에 로그인합니다.
            </li>
            <li>왼쪽 아래 <span className="font-semibold text-text">조직도</span>를 눌러 트리를 엽니다.</li>
            <li>
              F12 를 눌러 개발자 도구를 열고 <span className="font-semibold text-text">Console</span> 탭으로 갑니다.
            </li>
            <li>아래 스크립트를 복사해 붙여넣고 Enter 를 누릅니다. 100명 기준 20초쯤 걸립니다.</li>
            <li>CSV 가 내려받아지면 이 화면에서 그 파일을 올립니다.</li>
          </ol>

          <label className="mt-3 flex flex-wrap items-center gap-2 text-small text-text-muted">
            받을 센터
            <input
              value={scriptCenter}
              onChange={(event) => {
                setScriptCenter(event.target.value);
                setCopied(false);
              }}
              placeholder="비우면 전사 전체"
              className="rounded-lg border border-border px-2 py-1 text-small"
            />
            <span className="text-micro text-text-subtle">비우면 전사 전체를 받습니다.</span>
          </label>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard
                  .writeText(buildOrgExtractScript(scriptCenter))
                  .then(() => setCopied(true))
                  .catch(() => setCopied(false));
              }}
              className="rounded-lg bg-brand px-3 py-1.5 text-tiny font-bold text-white transition hover:bg-brand-hover"
            >
              스크립트 복사
            </button>
            {copied && <span className="text-micro text-verify-pass-fg">복사했습니다.</span>}
          </div>

          <pre className="mt-2 max-h-[180px] overflow-auto rounded-lg border border-border bg-surface p-3 text-nano leading-relaxed text-text-muted">
            {buildOrgExtractScript(scriptCenter)}
          </pre>
        </div>
      </details>

      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          onChange={(event) => onPick(event.target.files?.[0] ?? null)}
          className="text-small text-text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-brand file:px-3 file:py-1.5 file:text-tiny file:font-bold file:text-white hover:file:bg-brand-hover"
        />
        {fileName && (
          <span className="text-micro text-text-subtle">
            {fileName} · {rows.length}명
          </span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-small text-text-muted">
          <input
            type="checkbox"
            checked={deactivateMissing}
            onChange={(event) => setDeactivateMissing(event.target.checked)}
          />
          목록에 없는 사람을 비활성으로
        </label>
        {centersInFile.length > 0 && (
          <label className="flex items-center gap-2 text-small text-text-muted">
            비활성 대상 범위
            <select
              value={limitCenter}
              onChange={(event) => setLimitCenter(event.target.value)}
              className="rounded-lg border border-border px-2 py-1 text-small"
            >
              <option value="">전체</option>
              {centersInFile.map((center) => (
                <option key={center} value={center}>
                  {center}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || rows.length === 0}
          onClick={() => run(true)}
          className="rounded-lg border border-brand-soft bg-white px-4 py-2 text-small font-bold text-brand transition hover:bg-brand-soft disabled:opacity-50"
        >
          {busy ? '확인 중...' : '미리보기'}
        </button>
        <button
          type="button"
          disabled={busy || !preview}
          onClick={() => run(false)}
          className="rounded-lg bg-brand px-4 py-2 text-small font-bold text-white transition hover:bg-brand-hover disabled:opacity-50"
          title={preview ? undefined : '먼저 미리보기를 실행하세요.'}
        >
          반영하기
        </button>
      </div>

      <InlineMessage tone={tone} className="mt-3">{message}</InlineMessage>

      {problems.length > 0 && (
        <ul className="mt-3 rounded-lg bg-verify-warn-bg px-3 py-2 text-micro text-verify-warn-fg">
          {problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      )}

      {shown && (
        <div className="mt-5">
          <p className="mb-3 text-small text-text-muted">
            {shown.dry_run ? '바뀔 내용' : '반영 결과'} · 총 {shown.total_rows}줄 · 변화 없음{' '}
            {shown.unchanged}명
          </p>
          <div className="grid gap-3 lg:grid-cols-2">
            <ChangeList title="새로 추가" items={shown.created} tone="pass" />
            <ChangeList title="소속·직급 변경" items={shown.updated} tone="info" />
            <ChangeList title="비활성 처리" items={shown.deactivated} tone="fail" />
            <ChangeList title="다시 활성" items={shown.reactivated} tone="pass" />
            <ChangeList title="사번 보정" items={shown.idnum_fixed} tone="warn" />
            <ChangeList
              title="관리자라 건너뜀 (직접 확인 필요)"
              items={shown.admin_skipped}
              tone="warn"
            />
          </div>
          {shown.errors.length > 0 && (
            <ul className="mt-3 rounded-lg bg-verify-fail-bg px-3 py-2 text-micro text-verify-fail-fg">
              {shown.errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          )}
          {shown.created.length > 0 && shown.dry_run && (
            <p className="mt-3 text-micro text-text-subtle">
              새로 추가되는 계정의 초기 비밀번호는 12345678 입니다.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
