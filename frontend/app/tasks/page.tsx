'use client';

import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '../components/AppShell';
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

  const [selectedProjectId, setSelectedProjectId] = useState<number | ''>('');
  const [selectedSubprojectId, setSelectedSubprojectId] = useState<number | ''>('');
  const [availabilityWeight, setAvailabilityWeight] = useState(60);
  const [busy, setBusy] = useState(false);
  const [screenError, setScreenError] = useState('');
  const [recommendation, setRecommendation] = useState<RecommendationResponse | null>(null);
  const [assigningUserId, setAssigningUserId] = useState<number | null>(null);

  const capabilityWeight = 100 - availabilityWeight;

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );

  const projectSubprojects = useMemo(() => {
    if (!selectedProjectId) return [];
    return subprojects.filter((subproject) => subproject.project_id === selectedProjectId);
  }, [selectedProjectId, subprojects]);

  const selectedSubproject = useMemo(
    () => projectSubprojects.find((subproject) => subproject.id === selectedSubprojectId) ?? null,
    [projectSubprojects, selectedSubprojectId],
  );

  const participantCount = selectedProject?.participants?.length ?? 0;
  const canSubmit = Boolean(selectedProject && selectedSubproject) && !busy;

  function handleProjectChange(projectId: number | '') {
    setSelectedProjectId(projectId);
    setSelectedSubprojectId('');
    setRecommendation(null);
    setScreenError('');
  }

  function handleSubprojectChange(subprojectId: number | '') {
    setSelectedSubprojectId(subprojectId);
    setRecommendation(null);
    setScreenError('');
  }

  async function handleRecommend() {
    if (!canSubmit || !selectedProject || !selectedSubproject) return;
    setBusy(true);
    setScreenError('');

    try {
      const [response] = await Promise.all([
        apiFetch<RecommendationResponse>('/ai/recommendations', {
          method: 'POST',
          body: JSON.stringify({
            project_id: selectedProject.id,
            subproject_id: selectedSubproject.id,
            project_name: selectedProject.name,
            project_type: selectedProject.project_type,
            start_date: selectedSubproject.start_date,
            end_date: selectedSubproject.end_date,
            availability_weight: availabilityWeight / 100,
            capability_weight: capabilityWeight / 100,
          }),
        }),
        wait(800),
      ]);

      setRecommendation(response);
    } catch (err) {
      setScreenError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleAssign(candidate: RecommendationCandidate) {
    if (!selectedProject || !selectedSubproject) return;

    const payload: AssignmentRequest = {
      project_id: selectedProject.id,
      subproject_id: selectedSubproject.id,
      project_name: selectedProject.name,
      project_type: selectedProject.project_type,
      subproject_name: selectedSubproject.name,
      assignee_id: candidate.user_id,
      start_date: selectedSubproject.start_date,
      end_date: selectedSubproject.end_date,
      apply_template: false,
    };

    setAssigningUserId(candidate.user_id);
    setScreenError('');

    try {
      await apiFetch('/ai/assignments', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setSelectedMemberId(candidate.user_id);
      await wait(400);
      router.push('/personal-calendar');
    } catch (err) {
      setScreenError((err as Error).message);
    } finally {
      setAssigningUserId(null);
    }
  }

  if (meLoading || !me) {
    return <main className="p-8 text-text">불러오는 중...</main>;
  }

  if (me.role !== 'admin') {
    return (
      <AppShell me={me} sidebarProjects={projects} sidebarUsers={users}>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
          <h1 className="text-xl font-semibold">AI 업무 배정은 관리자 전용입니다</h1>
          <p className="mt-2 text-sm">
            개인 캘린더와 팀 캘린더에서 배정된 업무를 확인해주세요.
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
        <section className="rounded-3xl border border-border bg-white p-6 shadow-sm">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-text">AI 업무 배정</h1>
            <p className="mt-2 text-sm text-text-subtle">
              프로젝트와 하위 프로젝트를 선택하면 해당 프로젝트 참여 인원 안에서 추천 후보를 계산합니다.
            </p>
          </div>

          <div className="space-y-5">
            <Field label="프로젝트">
              <select
                value={selectedProjectId}
                onChange={(event) =>
                  handleProjectChange(event.target.value === '' ? '' : Number(event.target.value))
                }
                className="input"
              >
                <option value="">프로젝트를 선택하세요</option>
                {loading ? (
                  <option disabled>불러오는 중...</option>
                ) : (
                  projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))
                )}
              </select>
            </Field>

            <Field label="하위 프로젝트">
              <select
                value={selectedSubprojectId}
                onChange={(event) =>
                  handleSubprojectChange(event.target.value === '' ? '' : Number(event.target.value))
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
                {projectSubprojects.map((subproject) => (
                  <option key={subproject.id} value={subproject.id}>
                    {subproject.name}
                  </option>
                ))}
              </select>
            </Field>

            {selectedSubproject && (
              <div className="rounded-lg border border-verify-info-bg bg-verify-info-bg px-3 py-2 text-small font-semibold text-verify-info-fg">
                일정 {selectedSubproject.start_date} ~ {selectedSubproject.end_date}
              </div>
            )}

            <div className="rounded-2xl border border-border bg-surface-muted p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-text">업무량 가중치</p>
                  <p className="mt-1 text-xs text-text-subtle">
                    현재 업무량과 유사 업무 경험 중 무엇을 더 크게 반영할지 조정합니다.
                  </p>
                </div>
                <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-text-muted">
                  업무량 {availabilityWeight}% / 역량 {capabilityWeight}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={availabilityWeight}
                onChange={(event) => setAvailabilityWeight(Number(event.target.value))}
                className="mt-4 w-full accent-indigo-600"
              />
            </div>

            <button
              type="button"
              onClick={handleRecommend}
              disabled={!canSubmit}
              className="w-full rounded-lg bg-brand px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? '추천 분석 중...' : 'AI 추천 실행'}
            </button>
          </div>
        </section>

        <section className="rounded-3xl border border-border bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-text">추천 결과 TOP 3</h2>
              <p className="mt-2 text-sm text-text-subtle">
                선택한 프로젝트 참여 인원 중 업무량과 역량 점수가 높은 후보를 보여줍니다.
              </p>
              {recommendation && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <span
                    className={`rounded-full px-3 py-1 text-micro font-semibold ${
                      recommendation.claude_used
                        ? 'bg-brand-soft text-brand'
                        : 'bg-verify-fail-bg text-verify-fail-fg'
                    }`}
                  >
                    {recommendation.claude_used ? 'Claude API 사용' : '규칙 기반 추천'}
                  </span>
                  {recommendation.claude_error && (
                    <span className="text-micro text-verify-fail-fg">
                      사유: {recommendation.claude_error}
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="rounded-2xl bg-background px-4 py-3 text-right">
              <p className="text-xs text-text-subtle">프로젝트 참여 인원</p>
              <p className="text-2xl font-bold text-text">
                {loading ? '--' : participantCount}
              </p>
            </div>
          </div>

          {busy && (
            <div className="rounded-2xl border border-brand bg-brand-soft p-6 text-center">
              <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-brand-soft border-t-brand" />
              <p className="mt-4 text-sm font-medium text-brand-hover">
                업무 추천을 계산하는 중입니다
              </p>
              <p className="mt-1 text-xs text-brand">
                선택한 프로젝트 참여 인원의 업무량, 수행 이력, 프로젝트 유형 경험치를 반영합니다.
              </p>
            </div>
          )}

          {!busy && !recommendation && (
            <EmptyPanel text="왼쪽에서 프로젝트와 하위 프로젝트를 선택하고 추천을 실행하세요." />
          )}

          {!busy && recommendation && recommendation.candidates.length === 0 && (
            <EmptyPanel text="추천 가능한 후보가 없습니다. 프로젝트 참여 인원을 확인해주세요." />
          )}

          {!busy && recommendation && recommendation.candidates.length > 0 && (
            <div className="space-y-4">
              {recommendation.candidates.map((candidate) => (
                <article
                  key={candidate.user_id}
                  className={`rounded-xl border p-[13px] transition ${
                    candidate.rank === 1
                      ? 'border-brand bg-white'
                      : 'border-brand bg-white'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <div
                          className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-2 text-nano font-bold ${
                            candidate.rank === 1
                              ? 'bg-brand text-white'
                              : 'bg-brand-soft text-brand'
                          }`}
                        >
                          {candidate.rank}
                        </div>
                        <span className="rounded-full border border-brand-soft bg-brand-soft px-2.5 py-1 text-tiny font-bold text-brand">
                          {candidate.recommendation_source === 'claude'
                            ? 'Claude 추천'
                            : '규칙 기반'}
                        </span>
                      </div>
                      <h3 className="text-body font-bold text-text">{candidate.name}</h3>
                      <p className="mt-1 text-tiny text-text-subtle">
                        {candidate.position ? `${candidate.position} · ` : ''}
                        {candidate.role === 'admin' ? '관리자' : '구성원'} · 유사 업무{' '}
                        {candidate.keyword_experience_count}건 · 수행 이력{' '}
                        {candidate.history_experience_count}건
                      </p>
                    </div>
                    <div className="rounded-2xl bg-surface-muted px-4 py-3 text-right">
                      <p className="text-xs text-text-subtle">종합점수</p>
                      <p className="text-2xl font-bold text-brand">
                        {Math.round(candidate.score)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <MetricCard label="업무량" value={`${Math.round(candidate.availability_score)}점`} />
                    <MetricCard label="역량" value={`${Math.round(candidate.capability_score)}점`} />
                    <MetricCard label="잔여 업무" value={`${candidate.remaining_minutes}분`} />
                  </div>

                  <div className="mt-4 rounded-2xl bg-surface-muted p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-text">추천 이유</p>
                      <span className="text-micro text-text-subtle">
                        {candidate.recommendation_source === 'claude'
                          ? 'AI 생성 추천 이유'
                          : '규칙 기반 추천 이유'}
                      </span>
                    </div>
                    <ul className="mt-2 space-y-2 text-micro text-text-muted">
                      {candidate.reasons.map((reason, index) => (
                        <li
                          key={`${candidate.user_id}-${index}`}
                          className="flex items-start gap-2 rounded-xl bg-white px-3 py-2"
                        >
                          <span
                            className={`mt-1 h-1 w-1 rounded-full ${
                              index === 0
                                ? 'bg-brand'
                                : index === 1
                                  ? 'bg-verify-pass-fg'
                                  : 'bg-verify-warn-fg'
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
                    className="mt-4 w-full rounded-lg bg-brand px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {assigningUserId === candidate.user_id
                      ? '배정 적용 중...'
                      : `${candidate.name}에게 확정 배정`}
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
      <span className="mb-2 block text-sm font-medium text-text-muted">{label}</span>
      {children}
    </label>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white p-4">
      <p className="text-xs text-text-subtle">{label}</p>
      <p className="mt-1 text-lg font-semibold text-text">{value}</p>
    </div>
  );
}

function EmptyPanel({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border-strong bg-background px-6 py-12 text-center text-sm text-text-subtle">
      {text}
    </div>
  );
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
