'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import AppShell from '../components/AppShell';
import TeamModal from '../components/TeamModal';
import ProgressBar from '../components/ProgressBar';
import {
  apiFetch,
  PROJECT_TYPE_LABEL,
  VERIFICATION_LEVEL_LABEL,
  VERIFY_STATE_LABEL,
  type Project,
  type ProjectType,
  type SubProject,
  type UserBrief,
} from '../lib/api';
import { useMe } from '../lib/useMe';
import { SUBPROJECT_STATUS_LABEL, SUBPROJECT_STATUS_BADGE } from '../lib/subprojectStatus';

export default function ProjectsPage() {
  const { me, loading: meLoading } = useMe();
  const [projects, setProjects] = useState<Project[]>([]);
  const [subprojects, setSubProjects] = useState<SubProject[]>([]);
  const [users, setUsers] = useState<UserBrief[]>([]);
  const [name, setName] = useState('');
  const [type, setType] = useState<ProjectType>('official_inspection');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [modalProjectId, setModalProjectId] = useState<number | undefined>();
  const [modalInitial, setModalInitial] = useState<SubProject | null>(null);

  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const toggleExpand = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ps, sps, us] = await Promise.all([
        apiFetch<Project[]>('/projects'),
        apiFetch<SubProject[]>('/subprojects'),
        apiFetch<UserBrief[]>('/users'),
      ]);
      setProjects(ps);
      setSubProjects(sps);
      setUsers(us);
      setError('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (me) void load();
  }, [me, load]);

  const byProject = useMemo(() => {
    const m = new Map<number, SubProject[]>();
    for (const sp of subprojects) {
      const arr = m.get(sp.project_id) ?? [];
      arr.push(sp);
      m.set(sp.project_id, arr);
    }
    for (const arr of m.values())
      arr.sort((a, b) => a.start_date.localeCompare(b.start_date));
    return m;
  }, [subprojects]);

  const isAdmin = me?.role === 'admin';

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError('');
    try {
      const created = await apiFetch<Project>('/projects', {
        method: 'POST',
        body: JSON.stringify({ name, project_type: type }),
      });
      setName('');
      setType('official_inspection');
      await load();
      setExpanded((prev) => new Set(prev).add(created.id));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const openCreateSub = (projectId: number) => {
    if (!isAdmin) return;
    setModalMode('create');
    setModalProjectId(projectId);
    setModalInitial(null);
    setModalOpen(true);
  };

  const openEditSub = (sp: SubProject) => {
    setModalMode('edit');
    setModalProjectId(sp.project_id);
    setModalInitial(sp);
    setModalOpen(true);
  };

  if (meLoading || !me) {
    return <main className="p-8 text-slate-900">불러오는 중...</main>;
  }

  return (
    <AppShell me={me}>
      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      {isAdmin && (
        <form
          onSubmit={submit}
          className="mb-6 flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
        >
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-slate-600">
              프로젝트 이름
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 2026 Q2 정기 검증"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">유형</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as ProjectType)}
              className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="official_inspection">공식 검증</option>
              <option value="regular_inspection">정기 검증</option>
              <option value="change_inspection">변경점 검증</option>
              <option value="etc_task">기타 업무</option>
              <option value="general">일반</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={!name.trim() || busy}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            + 프로젝트 생성
          </button>
        </form>
      )}

      <div className="space-y-4">
        {loading && (
          <p className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">
            불러오는 중...
          </p>
        )}

        {!loading && projects.length === 0 && (
          <p className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">
            아직 프로젝트가 없습니다.{' '}
            {isAdmin ? '위에서 프로젝트를 먼저 만들어 주세요.' : ''}
          </p>
        )}

        {projects.map((p) => {
          const items = byProject.get(p.id) ?? [];
          const isOpen = expanded.has(p.id);
          const total = items.length;
          const done = items.filter((sp) => sp.status === 'completed').length;
          const typeLabel = PROJECT_TYPE_LABEL[p.project_type] ?? p.project_type;

          return (
            <section
              key={p.id}
              className="rounded-2xl border border-slate-200 bg-white shadow-sm"
            >
              <header className="flex flex-wrap items-center gap-3 p-4">
                <button
                  onClick={() => toggleExpand(p.id)}
                  className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-xs text-slate-500 hover:bg-slate-50"
                  aria-label={isOpen ? '접기' : '펼치기'}
                >
                  {isOpen ? '−' : '+'}
                </button>
                <div className="flex-1 min-w-[160px]">
                  <p className="text-base font-semibold">
                    {p.name}
                    <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                      {typeLabel}
                    </span>
                  </p>
                  <p className="text-[11px] text-slate-500">
                    생성 {new Date(p.created_at).toLocaleDateString('ko-KR')} ·
                    소프로젝트 {total}건 (완료 {done})
                  </p>
                </div>
                {isAdmin && (
                  <button
                    onClick={() => openCreateSub(p.id)}
                    className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    + 소프로젝트 추가
                  </button>
                )}
              </header>

              {isOpen && (
                <div className="border-t border-slate-100 bg-slate-50/40 p-4">
                  {items.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-400">
                      아직 소프로젝트가 없습니다.
                      {isAdmin &&
                        ' 위의 [+ 소프로젝트 추가] 버튼으로 만들 수 있어요.'}
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {items.map((sp) => {
                        const level = sp.verification_level
                          ? VERIFICATION_LEVEL_LABEL[sp.verification_level]
                          : null;
                        const first = sp.first_verify_status
                          ? VERIFY_STATE_LABEL[sp.first_verify_status]
                          : null;
                        const ir = sp.inreview_status
                          ? VERIFY_STATE_LABEL[sp.inreview_status]
                          : null;
                        const metaBits = [
                          sp.controller_name,
                          level,
                          sp.vehicle_type,
                        ].filter(Boolean);
                        return (
                          <li key={sp.id}>
                            <button
                              onClick={() => openEditSub(sp)}
                              className="block w-full rounded-xl border border-slate-100 bg-white p-3 text-left hover:bg-blue-50/40"
                            >
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-medium">{sp.name}</p>
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[11px] ${SUBPROJECT_STATUS_BADGE[sp.status]}`}
                                >
                                  {SUBPROJECT_STATUS_LABEL[sp.status]}
                                </span>
                                {sp.upload_done && (
                                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-600">
                                    업로드 완
                                  </span>
                                )}
                                <span className="ml-auto text-[11px] text-slate-500">
                                  {sp.start_date} ~ {sp.end_date}
                                </span>
                              </div>
                              {metaBits.length > 0 && (
                                <p className="mt-1 text-[11px] text-slate-500">
                                  {metaBits.join(' · ')}
                                </p>
                              )}
                              {(first || ir) && (
                                <p className="mt-1 text-[11px] text-slate-600">
                                  1차: {first ?? '—'} &nbsp;//&nbsp; InReview:{' '}
                                  {ir ?? '—'}
                                </p>
                              )}
                              <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
                                <span>
                                  {sp.assignee?.name ?? '담당자 미지정'}
                                </span>
                                <span>{sp.progress.toFixed(0)}%</span>
                              </div>
                              <ProgressBar
                                value={sp.progress}
                                className="mt-2"
                                ariaLabel={`${sp.name} 진척도`}
                              />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}
            </section>
          );
        })}
      </div>

      <TeamModal
        open={modalOpen}
        mode={modalMode}
        isAdmin={!!isAdmin}
        users={users}
        projects={projects}
        lockedProjectId={modalMode === 'create' ? modalProjectId : undefined}
        initial={modalInitial}
        onClose={() => setModalOpen(false)}
        onSaved={load}
      />
    </AppShell>
  );
}
