'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import AppShell from '../components/AppShell';
import MonthCalendar, { shiftMonth } from '../components/MonthCalendar';
import PersonalModal from '../components/PersonalModal';
import { apiFetch, type SubProject, type UserBrief } from '../lib/api';
import { useMe } from '../lib/useMe';

export default function PersonalCalendarPage() {
  const { me, loading: meLoading } = useMe();
  const [users, setUsers] = useState<UserBrief[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [subprojects, setSubProjects] = useState<SubProject[]>([]);
  const [cursor, setCursor] = useState(() => new Date());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [openSp, setOpenSp] = useState<SubProject | null>(null);

  // 사용자 목록 로드 + 본인을 기본 선택
  useEffect(() => {
    if (!me) return;
    (async () => {
      try {
        const us = await apiFetch<UserBrief[]>('/users');
        setUsers(us);
        setSelectedUserId(me.id);
      } catch (err) {
        setError((err as Error).message);
      }
    })();
  }, [me]);

  const loadSubprojects = useCallback(async (userId: number) => {
    setLoading(true);
    try {
      const sps = await apiFetch<SubProject[]>(
        `/subprojects?assignee_id=${userId}`,
      );
      setSubProjects(sps);
      setError('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedUserId !== null) void loadSubprojects(selectedUserId);
  }, [selectedUserId, loadSubprojects]);

  const orderedList = useMemo(
    () => [...subprojects].sort((a, b) => a.start_date.localeCompare(b.start_date)),
    [subprojects],
  );

  const refreshOpenSp = useCallback(async () => {
    if (selectedUserId !== null) await loadSubprojects(selectedUserId);
    if (openSp) {
      try {
        const fresh = await apiFetch<SubProject>(`/subprojects/${openSp.id}`);
        setOpenSp(fresh);
      } catch {
        // ignore
      }
    }
  }, [selectedUserId, openSp, loadSubprojects]);

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

      {/* 팀원 카드 */}
      <div className="mb-4 flex flex-wrap gap-2">
        {users.map((u) => {
          const active = u.id === selectedUserId;
          return (
            <button
              key={u.id}
              onClick={() => setSelectedUserId(u.id)}
              className={`rounded-xl border px-3 py-2 text-sm ${
                active
                  ? 'border-blue-500 bg-blue-600 text-white'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {u.name}
              <span className="ml-1 text-[11px] opacity-70">
                ({u.role === 'admin' ? '관리자' : '일반'})
              </span>
            </button>
          );
        })}
      </div>

      {selectedUserId === null ? (
        <p className="rounded-lg bg-slate-100 px-4 py-6 text-center text-sm text-slate-500">
          팀원을 먼저 선택해주세요.
        </p>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <MonthCalendar
            year={cursor.getFullYear()}
            month={cursor.getMonth()}
            subprojects={subprojects}
            onPrevMonth={() => setCursor((c) => shiftMonth(c, -1))}
            onNextMonth={() => setCursor((c) => shiftMonth(c, +1))}
            onSelectSubProject={(sp) => setOpenSp(sp)}
          />

          <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-base font-semibold">담당 소프로젝트</h3>
            <p className="mt-1 text-xs text-slate-400">
              체크박스로 단계별 진척을 기록할 수 있습니다.
            </p>

            <div className="mt-3 max-h-[560px] space-y-2 overflow-y-auto">
              {loading && (
                <p className="py-4 text-center text-sm text-slate-400">
                  불러오는 중...
                </p>
              )}
              {!loading && orderedList.length === 0 && (
                <p className="py-4 text-center text-sm text-slate-400">
                  배정된 소프로젝트가 없습니다.
                </p>
              )}
              {orderedList.map((sp) => (
                <button
                  key={sp.id}
                  onClick={() => setOpenSp(sp)}
                  className="block w-full rounded-xl border border-slate-100 bg-slate-50 p-3 text-left hover:bg-slate-100"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{sp.name}</span>
                    {sp.status === 'completed' && (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                        완료
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-[11px] text-slate-500">
                    {sp.start_date} ~ {sp.end_date}
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full bg-blue-500"
                      style={{ width: `${sp.progress}%` }}
                    />
                  </div>
                </button>
              ))}
            </div>
          </aside>
        </div>
      )}

      <PersonalModal
        open={openSp !== null}
        isAdmin={me.role === 'admin'}
        currentUserId={me.id}
        subproject={openSp}
        onClose={() => setOpenSp(null)}
        onChanged={refreshOpenSp}
      />
    </AppShell>
  );
}
