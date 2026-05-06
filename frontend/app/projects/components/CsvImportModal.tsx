'use client';

import { useRef, useState } from 'react';
import Modal from '../../components/Modal';
import { apiFetch, type SubProject, type UserBrief } from '../../lib/api';

type ParsedRow = {
  name: string;
  start_date: string;
  end_date: string;
  assignee_name: string;
  assignee_id: number | null;
  error: string | null;
};

type ResultRow = ParsedRow & { status: 'ok' | 'error'; detail: string };

type Props = {
  open: boolean;
  projectId: number;
  users: UserBrief[];
  onClose: () => void;
  onImported: () => Promise<void>;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseDate(raw: string): string | null {
  const v = raw.trim();
  if (DATE_RE.test(v)) return v;
  const replaced = v.replace(/[./]/g, '-');
  if (DATE_RE.test(replaced)) return replaced;
  return null;
}

function parseCsv(text: string, users: UserBrief[]): ParsedRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];

  const dataLines = lines.slice(1);

  return dataLines.map((line) => {
    const cols = line.split(',').map((c) => c.replace(/^"|"$/g, '').trim());
    const [rawName = '', rawStart = '', rawEnd = '', rawAssignee = ''] = cols;

    const name = rawName.trim();
    const start_date = parseDate(rawStart) ?? '';
    const end_date = parseDate(rawEnd) ?? '';
    const assignee_name = rawAssignee.trim();

    const matched =
      users.find((u) => u.name === assignee_name || u.idnum === assignee_name) ?? null;
    const assignee_id = matched?.id ?? null;

    const errors: string[] = [];
    if (!name) errors.push('업무명 누락');
    if (!start_date) errors.push('시작일 형식 오류');
    if (!end_date) errors.push('종료일 형식 오류');
    if (start_date && end_date && end_date < start_date)
      errors.push('종료일 < 시작일');
    if (!assignee_id) errors.push(`담당자 미매칭(${assignee_name || '없음'})`);

    return {
      name,
      start_date,
      end_date,
      assignee_name,
      assignee_id,
      error: errors.length > 0 ? errors.join(', ') : null,
    };
  });
}

export default function CsvImportModal({
  open,
  projectId,
  users,
  onClose,
  onImported,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [results, setResults] = useState<ResultRow[] | null>(null);
  const [importing, setImporting] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [showUserList, setShowUserList] = useState(false);
  const [userSearch, setUserSearch] = useState('');

  const validRows = rows.filter((r) => r.error === null);
  const invalidRows = rows.filter((r) => r.error !== null);

  const filteredUsers = users.filter((u) => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      u.name.toLowerCase().includes(q) ||
      u.idnum.toLowerCase().includes(q) ||
      (u.team ?? '').toLowerCase().includes(q) ||
      (u.office ?? '').toLowerCase().includes(q)
    );
  });

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.csv')) {
      setFileError('CSV 파일(.csv)만 지원합니다.');
      return;
    }
    setFileError(null);
    setResults(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = (ev.target?.result as string) ?? '';
      const parsed = parseCsv(text, users);
      setRows(parsed);
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleImport = async () => {
    if (validRows.length === 0) return;
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
            project_id: projectId,
            name: row.name,
            start_date: row.start_date,
            end_date: row.end_date,
            assignee_ids: [row.assignee_id],
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

    const anyOk = resultList.some((r) => r.status === 'ok');
    if (anyOk) await onImported();
  };

  const handleClose = () => {
    setRows([]);
    setResults(null);
    setFileError(null);
    setShowUserList(false);
    setUserSearch('');
    if (fileRef.current) fileRef.current.value = '';
    onClose();
  };

  const downloadSample = () => {
    // Sheet 1: 등록 양식
    let csv = '﻿업무명,시작일(YYYY-MM-DD),종료일(YYYY-MM-DD),담당자(이름 또는 사번)\n';
    csv += '샘플 업무 A,2026-05-01,2026-05-31,' + (users[0]?.name ?? '홍길동') + '\n';
    csv += '샘플 업무 B,2026-06-01,2026-06-30,' + (users[1]?.name ?? '김철수') + '\n';
    csv += '\n';
    // Sheet 2: 담당자 목록 (참고용)
    csv += '[ 담당자 참고 목록 — 아래 행은 실제 등록 시 삭제하세요 ]\n';
    csv += '이름,사번,직급,팀,부서(실),센터\n';
    for (const u of users) {
      csv += [u.name, u.idnum, u.position ?? '', u.team ?? '', u.office ?? '', u.center ?? ''].join(',') + '\n';
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '하위프로젝트_일괄등록_양식.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Modal open={open} onClose={handleClose} size="lg">
      <div className="space-y-4">
        <h2 className="text-[15px] font-bold tracking-[-0.2px] text-[#1A1A1A]">
          CSV로 하위 프로젝트 일괄 등록
        </h2>

        {/* 파일 선택 & 샘플 다운로드 */}
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-[12px] border border-[#DDDAD0] bg-white px-4 py-2 text-[12px] font-semibold text-[#1A1A1A] hover:bg-[#FAFAF7]">
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
            className="text-[11px] font-medium text-[#534AB7] underline underline-offset-2 hover:text-[#473EA7]"
          >
            양식 다운로드
          </button>

          <p className="text-[11px] text-[#888780]">
            컬럼: 업무명 / 시작일 / 종료일 / 담당자(이름 또는 사번)
          </p>
        </div>

        {/* 담당자 목록 토글 */}
        <div className="rounded-[14px] border border-[#EAEAE4] bg-[#FAFAF7]">
          <button
            type="button"
            onClick={() => setShowUserList((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-2.5 text-[11px] font-semibold text-[#5F5E5A]"
          >
            <span>
              담당자 목록 보기{' '}
              <span className="font-normal text-[#888780]">({users.length}명)</span>
            </span>
            <span
              className={`inline-block text-[9px] text-[#888780] transition-transform ${
                showUserList ? 'rotate-90' : ''
              }`}
            >
              ▶
            </span>
          </button>

          {showUserList && (
            <div className="border-t border-[#EAEAE4] px-4 pb-3 pt-2">
              <input
                type="text"
                placeholder="이름 · 사번 · 팀으로 검색"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="mb-2 w-full rounded-[10px] border border-[#DDDAD0] bg-white px-3 py-1.5 text-[11px] outline-none focus:border-[#534AB7]"
              />
              <div className="max-h-[200px] overflow-auto rounded-[10px] border border-[#EAEAE4]">
                <table className="w-full text-left text-[11px]">
                  <thead className="sticky top-0 bg-[#F4F4F0]">
                    <tr>
                      <th className="px-3 py-1.5 font-semibold text-[#5F5E5A]">이름</th>
                      <th className="px-3 py-1.5 font-semibold text-[#5F5E5A]">사번</th>
                      <th className="px-3 py-1.5 font-semibold text-[#5F5E5A]">직급</th>
                      <th className="px-3 py-1.5 font-semibold text-[#5F5E5A]">팀</th>
                      <th className="px-3 py-1.5 font-semibold text-[#5F5E5A]">부서(실)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F0EEE7] bg-white">
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-3 py-3 text-center text-[#888780]">
                          검색 결과가 없습니다.
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((u) => (
                        <tr key={u.id}>
                          <td className="px-3 py-1.5 font-medium text-[#1A1A1A]">{u.name}</td>
                          <td className="px-3 py-1.5 font-mono text-[#534AB7]">{u.idnum}</td>
                          <td className="px-3 py-1.5 text-[#5F5E5A]">{u.position ?? '—'}</td>
                          <td className="px-3 py-1.5 text-[#5F5E5A]">{u.team ?? '—'}</td>
                          <td className="px-3 py-1.5 text-[#5F5E5A]">{u.office ?? '—'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <p className="mt-1.5 text-[10px] text-[#888780]">
                이름 또는 사번을 그대로 CSV 담당자 열에 입력하세요.
              </p>
            </div>
          )}
        </div>

        {fileError && (
          <p className="text-[12px] text-[#A32D2D]">{fileError}</p>
        )}

        {/* 파싱 결과 미리보기 */}
        {rows.length > 0 && !results && (
          <>
            <div className="rounded-[14px] border border-[#EAEAE4] bg-[#FAFAF7] px-4 py-2.5 text-[11px] text-[#5F5E5A]">
              총 <strong>{rows.length}</strong>행 파싱 —{' '}
              <span className="text-[#0F6E56]">유효 {validRows.length}건</span>
              {invalidRows.length > 0 && (
                <span className="ml-2 text-[#A32D2D]">오류 {invalidRows.length}건</span>
              )}
            </div>

            <div className="max-h-[280px] overflow-auto rounded-[14px] border border-[#EAEAE4]">
              <table className="w-full text-left text-[11px]">
                <thead className="sticky top-0 bg-[#F4F4F0]">
                  <tr>
                    <th className="px-3 py-2 font-semibold text-[#5F5E5A]">#</th>
                    <th className="px-3 py-2 font-semibold text-[#5F5E5A]">업무명</th>
                    <th className="px-3 py-2 font-semibold text-[#5F5E5A]">시작일</th>
                    <th className="px-3 py-2 font-semibold text-[#5F5E5A]">종료일</th>
                    <th className="px-3 py-2 font-semibold text-[#5F5E5A]">담당자</th>
                    <th className="px-3 py-2 font-semibold text-[#5F5E5A]">직급/팀</th>
                    <th className="px-3 py-2 font-semibold text-[#5F5E5A]">상태</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0EEE7] bg-white">
                  {rows.map((row, i) => {
                    const matched = row.assignee_id
                      ? users.find((u) => u.id === row.assignee_id)
                      : null;
                    return (
                      <tr key={i} className={row.error ? 'bg-[#FFF7F7]' : ''}>
                        <td className="px-3 py-2 text-[#888780]">{i + 1}</td>
                        <td className="px-3 py-2 font-medium text-[#1A1A1A]">{row.name || '—'}</td>
                        <td className="px-3 py-2 text-[#5F5E5A]">{row.start_date || '—'}</td>
                        <td className="px-3 py-2 text-[#5F5E5A]">{row.end_date || '—'}</td>
                        <td className="px-3 py-2 text-[#5F5E5A]">
                          {matched ? matched.name : row.assignee_name || '—'}
                        </td>
                        <td className="px-3 py-2 text-[#888780]">
                          {matched
                            ? [matched.position, matched.team].filter(Boolean).join(' · ')
                            : '—'}
                        </td>
                        <td className="px-3 py-2">
                          {row.error ? (
                            <span className="text-[#A32D2D]">{row.error}</span>
                          ) : (
                            <span className="text-[#0F6E56]">✓ 정상</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {validRows.length > 0 && (
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="rounded-[12px] border border-[#DDDAD0] px-4 py-2 text-[12px] font-semibold text-[#5F5E5A] hover:bg-[#F4F4F0]"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={() => void handleImport()}
                  disabled={importing}
                  className="rounded-[12px] bg-[#534AB7] px-5 py-2 text-[12px] font-bold text-white shadow-[0_4px_12px_rgba(83,74,183,0.24)] hover:bg-[#473EA7] disabled:opacity-50"
                >
                  {importing ? '등록 중...' : `${validRows.length}건 일괄 등록`}
                </button>
              </div>
            )}
          </>
        )}

        {/* 등록 결과 */}
        {results && (
          <>
            <div className="rounded-[14px] border border-[#EAEAE4] bg-[#FAFAF7] px-4 py-2.5 text-[11px] text-[#5F5E5A]">
              등록 완료:{' '}
              <span className="text-[#0F6E56]">
                {results.filter((r) => r.status === 'ok').length}건
              </span>
              {results.some((r) => r.status === 'error') && (
                <>
                  {' / '}
                  <span className="text-[#A32D2D]">
                    실패 {results.filter((r) => r.status === 'error').length}건
                  </span>
                </>
              )}
            </div>

            <div className="max-h-[280px] overflow-auto rounded-[14px] border border-[#EAEAE4]">
              <table className="w-full text-left text-[11px]">
                <thead className="sticky top-0 bg-[#F4F4F0]">
                  <tr>
                    <th className="px-3 py-2 font-semibold text-[#5F5E5A]">#</th>
                    <th className="px-3 py-2 font-semibold text-[#5F5E5A]">업무명</th>
                    <th className="px-3 py-2 font-semibold text-[#5F5E5A]">결과</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0EEE7] bg-white">
                  {results.map((row, i) => (
                    <tr key={i} className={row.status === 'error' ? 'bg-[#FFF7F7]' : ''}>
                      <td className="px-3 py-2 text-[#888780]">{i + 1}</td>
                      <td className="px-3 py-2 font-medium text-[#1A1A1A]">{row.name || '—'}</td>
                      <td className="px-3 py-2">
                        {row.status === 'ok' ? (
                          <span className="text-[#0F6E56]">✓ {row.detail}</span>
                        ) : (
                          <span className="text-[#A32D2D]">✗ {row.detail}</span>
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
                className="rounded-[12px] bg-[#534AB7] px-5 py-2 text-[12px] font-bold text-white hover:bg-[#473EA7]"
              >
                닫기
              </button>
            </div>
          </>
        )}

        {rows.length === 0 && !fileError && (
          <p className="rounded-[14px] border border-dashed border-[#D7D4CA] px-5 py-8 text-center text-[12px] text-[#8B897F]">
            CSV 파일을 선택하면 미리보기가 표시됩니다.
          </p>
        )}
      </div>
    </Modal>
  );
}
