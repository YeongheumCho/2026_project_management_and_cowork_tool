'use client';

import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '../components/AppShell';
import DatePicker from '../components/DatePicker';
import {
  apiFetch,
  type AssignmentRequest,
  type RecommendationCandidate,
  type RecommendationResponse,
} from '../lib/api';
import { useMe } from '../lib/useMe';
import { useWorkflowSelection } from '../lib/workflow-selection';
import { useDashboardData } from '../dashboard/hooks/useDashboardData';

export default function TasksPage() {
  const router = useRouter();
  const { me, loading: meLoading } = useMe();
  const { setSelectedMemberId } = useWorkflowSelection();
  const { projects, subprojects, users, loading, error } = useDashboardData(!!me);

  const today = new Date();
  const weekLater = new Date(today);
  weekLater.setDate(today.getDate() + 7);

  // ── 선택 상태 ──────────────────────────────────────────────────────────────
  const [selectedProjectId, setSelectedProjectId] = useState<number | ''>('');
  const [selectedSubprojectId, setSelectedSubprojectId] = useState<number | ''>('');
  const [startDate, setStartDate] = useState(toISODate(today));
  const [endDate, setEndDate] = useState(toISODate(weekLater));
  const [selectedOffice, setSelectedOffice] = useState('');
  const [selectedTeam, setSelectedTeam] = useState('');
  const [availabilityWeight, setAvailabilityWeight] = useState(60);
  const [busy, setBusy] = useState(false);
  const [screenError, setScreenError] = useState('');
  const [recommendation, setRecommendation] = useState<RecommendationResponse | null>(null);
  const [assigningUserId, setAssigningUserId] = useState<number | null>(null);

  const capabilityWeight = 100 - availabilityWeight;

  // ── 파생 값 ────────────────────────────────────────────────────────────────
  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );

  // 선택한 프로젝트에 속한 소프로젝트 목록
  const projectSubprojects = useMemo(() => {
    if (!selectedProjectId) return [];
    return subprojects.filter((sp) => sp.project_id === selectedProjectId);
  }, [subprojects, selectedProjectId]);

  const selectedSubproject = useMemo(
    () => projectSubprojects.find((sp) => sp.id === selectedSubprojectId) ?? null,
    [projectSubprojects, selectedSubprojectId],
  );

  // 실 필터 옵션 (전체 사용자 기준)
  const officeOptions = useMemo(
    () =>
      Array.from(
        new Set(
          users
            .map((u) => (u.office ?? '').trim())
            .filter(Boolean),
        ),
      ).sort((a, b) => a.localeCompare(b, 'ko')),
    [users],
  );

  // 팀 필터 옵션 (선택한 실 기준)
  const teamOptions = useMemo(() => {
    const filtered = selectedOffice
      ? users.filter((u) => (u.office ?? '').trim() === selectedOffice)
      : users;
    return Array.from(
      new Set(filtered.map((u) => (u.team ?? '').trim()).filter(Boolean)),
    ).sort((a, b) => a.localeCompare(b, 'ko'));
  }, [users, selectedOffice]);

  // 활성 인원: 프로젝트가 선택되면 해당 프로젝트 참여자 수, 아니면 전체
  const activeCount = selectedProject
    ? (selectedProject.participants?.length ?? 0)
    : users.length;

  const canSubmit =
    selectedProjectId !== '' &&
    selectedSubprojectId !== '' &&
    !busy;

  // ── 이벤트 핸들러 ─────────────────────────────────────────────────────────
  function handleProjectChange(projectId: number | '') {
    setSelectedProjectId(projectId);
    setSelectedSubprojectId(''); // 소프로젝트 초기화
    setRecommendation(null);
  }

  async function handleRecommend() {
    if (!canSubmit || !selectedProject) return;
    setBusy(true);
    setScreenError('');

    try {
      const response = await Promise.all([
        apiFetch<RecommendationResponse>('/ai/recommendations', {
          method: 'POST',
          body: JSON.stringify({
            project_name: selectedProject.name,
            project_type: selectedProject.project_type,
            start_date: startDate,
            end_date: endDate,
            office: selectedOffice || null,
            team: selectedTeam || null,
            availability_weight: availabilityWeight / 100,
            capability_weight: capabilityWeight / 100,
          }),
        }),
        wait(1400),
      ]);

      setRecommendation(response[0]);
    } catch (err) {
      setScreenError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleAssign(candidate: RecommendationCandidate) {
    if (!selectedProject || !selectedSubproject) return;

    const payload: AssignmentRequest = {
      project_name: selectedProject.name,
      project_type: selectedProject.project_type,
      subproject_name: selectedSubproject.name,
      assignee_id: candidate.user_id,
      start_date: startDate,
      end_date: endDate,
      apply_template: true,
    };

    setAssigningUserId(candidate.user_id);
    setScreenError('');

    try {
      await apiFetch('/ai/assignments', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setSelectedMemberId(candidate.user_id);
      await wait(600);
      router.push('/personal-calendar');
    } catch (err) {
      setScreenError((err as Error).message);
    } finally {
      setAssigningUserId(null);
    }
  }

  // ── 렌더 ──────────────────────────────────────────────────────────────────
  if (meLoading || !me) {
    return <main className="p-8 text-slate-900">불러오는 중...</main>;
  }

  if (me.role !== 'admin') {
    return (
      <AppShell me={me} sidebarProjects={projects} sidebarUsers={users}>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
          <h1 className="text-xl font-semibold">AI 업무 배정은 관리자 전용입니다.</h1>
          <p className="mt-2 text-sm">
            개인 캘린더와 팀 캘린더에서 배정된 작업을 확인해주세요.
          </p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell me={me} sidebarProjects={projects} sidebarUsers={users}>
      {(error || screenError) && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error || screenError}
        </p>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(360px,1.05fr)]">
        {/* ── 왼쪽: 입력 폼 ─────────────────────────────────────────── */}
        <section className="rounded-3xl border border-[#EAEAE4] bg-white p-6 shadow-sm">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-slate-900">AI 업무 배정</h1>
            <p className="mt-2 text-sm text-slate-500">
              프로젝트 조건을 입력하면 가용성과 적합도를 함께 고려해 상위 3명의 추천 후보를 제안합니다.
            </p>
          </div>

          <div className="space-y-5">
            {/* 프로젝트명 드롭다운 */}
            <Field label="프로젝트명">
              <select
                value={selectedProjectId}
                onChange={(e) =>
                  handleProjectChange(e.target.value === '' ? '' : Number(e.target.value))
                }
                className="input"
              >
                <option value="">프로젝트를 선택하세요</option>
                {loading ? (
                  <option disabled>불러오는 중...</option>
                ) : (
                  projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))
                )}
              </select>
            </Field>

            {/* 배정할 업무명 드롭다운 (하위 프로젝트명) */}
            <Field label="배정할 업무명 (하위 프로젝트명)">
              <select
                value={selectedSubprojectId}
                onChange={(e) =>
                  setSelectedSubprojectId(e.target.value === '' ? '' : Number(e.target.value))
                }
                disabled={!selectedProjectId}
                className="input disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">
                  {selectedProjectId
                    ? projectSubprojects.length === 0
                      ? '등록된 하위 프로젝트가 없습니다'
                      : '하위 프로젝트를 선택하세요'
                    : '먼저 프로젝트를 선택하세요'}
                </option>
                {projectSubprojects.map((sp) => (
                  <option key={sp.id} value={sp.id}>
                    {sp.name}
                  </option>
                ))}
              </select>
            </Field>

            {/* 실 / 팀 필터 */}
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="실 단위 선택">
                <select
                  value={selectedOffice}
                  onChange={(e) => {
                    setSelectedOffice(e.target.value);
                    setSelectedTeam('');
                  }}
                  className="input"
                >
                  <option value="">전체 실</option>
                  {officeOptions.map((office) => (
                    <option key={office} value={office}>
                      {office}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="팀 단위 선택">
                <select
                  value={selectedTeam}
                  onChange={(e) => setSelectedTeam(e.target.value)}
                  className="input"
                >
                  <option value="">전체 팀</option>
                  {teamOptions.map((team) => (
                    <option key={team} value={team}>
                      {team}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            {/* 날짜 */}
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="시작일">
                <DatePicker value={startDate} onChange={setStartDate} />
              </Field>
              <Field label="종료일">
                <DatePicker value={endDate} onChange={setEndDate} min={startDate} />
              </Field>
            </div>

            {startDate && endDate && (
              <div className="rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-2 text-[12px] font-semibold text-[#1D4ED8]">
                일정 {startDate} ~ {endDate}
              </div>
            )}

            {/* 가용성 가중치 */}
            <div className="rounded-2xl border border-[#EAEAE4] bg-[#FAFAFA] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[#1A1A1A]">가용성 가중치</p>
                  <p className="mt-1 text-xs text-[#888780]">
                    현재 업무량과 일정 여유를 얼마나 크게 반영할지 조정합니다.
                  </p>
                </div>
                <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-[#5F5E5A]">
                  {availabilityWeight}% / 역량 {capabilityWeight}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={availabilityWeight}
                onChange={(e) => setAvailabilityWeight(Number(e.target.value))}
                className="mt-4 w-full accent-indigo-600"
              />
            </div>

            <button
              type="button"
              onClick={handleRecommend}
              disabled={!canSubmit}
              className="w-full rounded-lg bg-[#534AB7] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#433A9A] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? '추천 분석 중...' : 'AI 추천 실행'}
            </button>
          </div>
        </section>

        {/* ── 오른쪽: 추천 결과 ─────────────────────────────────────── */}
        <section className="rounded-3xl border border-[#EAEAE4] bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">추천 결과 TOP 3</h2>
              <p className="mt-2 text-sm text-slate-500">
                센터장, 실장, 팀장은 추천 후보에서 제외되며, Claude가 추천 이유를 보강합니다.
              </p>
              {recommendation && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <span
                    className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                      recommendation.claude_used
                        ? 'bg-[#EEEDFE] text-[#534AB7]'
                        : 'bg-[#FFF4F4] text-[#A32D2D]'
                    }`}
                  >
                    {recommendation.claude_used ? 'Claude API 사용됨' : 'Claude API 미사용'}
                  </span>
                  {recommendation.claude_error && (
                    <span className="text-[11px] text-[#A32D2D]">
                      사유: {recommendation.claude_error}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* 활성 인원: 선택한 프로젝트 참여자 수 기준 */}
            <div className="rounded-2xl bg-[#F8F8F5] px-4 py-3 text-right">
              <p className="text-xs text-[#888780]">
                {selectedProject ? '프로젝트 인원' : '활성 인원'}
              </p>
              <p className="text-2xl font-bold text-[#1A1A1A]">
                {loading ? '--' : activeCount}
              </p>
            </div>
          </div>

          {busy && (
            <div className="rounded-2xl border border-[#AFA9EC] bg-[#EEEDFE] p-6 text-center">
              <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-[#D9D7FB] border-t-[#534AB7]" />
              <p className="mt-4 text-sm font-medium text-[#26215C]">업무 추천을 계산하는 중입니다</p>
              <p className="mt-1 text-xs text-[#534AB7]">
                최근 수행 이력, 잔여 업무, 프로젝트 유형 경험치와 Claude 추천을 함께 반영하고 있습니다.
              </p>
            </div>
          )}

          {!busy && !recommendation && (
            <EmptyPanel text="왼쪽에서 조건을 입력하고 추천을 실행하면 후보 카드가 여기에 표시됩니다." />
          )}

          {!busy && recommendation && recommendation.candidates.length === 0 && (
            <EmptyPanel text="추천 가능한 후보가 없습니다. 날짜나 가중치를 조정해보세요." />
          )}

          {!busy && recommendation && recommendation.candidates.length > 0 && (
            <div className="space-y-4">
              {recommendation.candidates.map((candidate) => (
                <article
                  key={candidate.user_id}
                  className={`rounded-xl border p-[13px] transition ${
                    candidate.rank === 1
                      ? 'border-[#534AB7] bg-white'
                      : 'border-[#AFA9EC] bg-white'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <div
                          className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-2 text-[9px] font-bold ${
                            candidate.rank === 1
                              ? 'bg-[#534AB7] text-white'
                              : 'bg-[#EEEDFE] text-[#534AB7]'
                          }`}
                        >
                          {candidate.rank}
                        </div>
                        {candidate.recommendation_source === 'claude' ? (
                          <span className="rounded-full border border-[#D8D3FF] bg-[#F5F3FF] px-2.5 py-1 text-[10px] font-bold text-[#534AB7]">
                            Claude 추천
                          </span>
                        ) : (
                          <span className="rounded-full border border-[#F1D5D5] bg-[#FFF7F7] px-2.5 py-1 text-[10px] font-bold text-[#A32D2D]">
                            규칙 기반
                          </span>
                        )}
                      </div>
                      <h3 className="text-[13px] font-bold text-[#1A1A1A]">{candidate.name}</h3>
                      <p className="mt-1 text-[10px] text-[#888780]">
                        {candidate.position ? `${candidate.position} · ` : ''}
                        {candidate.role === 'admin' ? '관리자' : '구성원'} · 유사 업무{' '}
                        {candidate.keyword_experience_count}건 · 수행 이력{' '}
                        {candidate.history_experience_count}건
                      </p>
                    </div>
                    <div className="rounded-2xl bg-[#FAFAFA] px-4 py-3 text-right">
                      <p className="text-xs text-[#888780]">종합점수</p>
                      <p className="text-2xl font-bold text-[#534AB7]">
                        {Math.round(candidate.score)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <MetricCard label="가용성" value={`${Math.round(candidate.availability_score)}점`} />
                    <MetricCard label="역량" value={`${Math.round(candidate.capability_score)}점`} />
                    <MetricCard label="잔여 업무" value={`${candidate.remaining_minutes}분`} />
                  </div>

                  <div className="mt-4 rounded-2xl bg-[#FAFAFA] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-[#1A1A1A]">추천 이유</p>
                      <span className="text-[11px] text-[#888780]">
                        {candidate.recommendation_source === 'claude'
                          ? 'AI가 생성한 추천 이유'
                          : '규칙 기반 추천 이유'}
                      </span>
                    </div>
                    <ul className="mt-2 space-y-2 text-[11px] text-[#5F5E5A]">
                      {candidate.reasons.map((reason, index) => (
                        <li
                          key={`${candidate.user_id}-${index}`}
                          className="flex items-start gap-2 rounded-xl bg-white px-3 py-2"
                        >
                          <span
                            className={`mt-1 h-1 w-1 rounded-full ${
                              index === 0
                                ? 'bg-[#534AB7]'
                                : index === 1
                                  ? 'bg-[#0F6E56]'
                                  : 'bg-[#854F0B]'
                            }`}
                          />
                          {reason}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <button
                    type="button"
                    disabled={assigningUserId !== null}
                    onClick={() => handleAssign(candidate)}
                    className="mt-4 w-full rounded-lg bg-[#534AB7] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#433A9A] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {assigningUserId === candidate.user_id
                      ? '배정 적용 중...'
                      : `${candidate.name}님에게 확정 배정`}
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-[#5F5E5A]">{label}</span>
      {children}
    </label>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white p-4">
      <p className="text-xs text-[#888780]">{label}</p>
      <p className="mt-1 text-lg font-semibold text-[#1A1A1A]">{value}</p>
    </div>
  );
}

function EmptyPanel({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-[#D3D1C7] bg-[#F8F8F5] px-6 py-12 text-center text-sm text-[#888780]">
      {text}
    </div>
  );
}

function toISODate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
