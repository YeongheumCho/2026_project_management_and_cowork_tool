'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import AppShell from '../components/AppShell';
import MonthCalendar, { shiftMonth } from '../components/MonthCalendar';
import PersonalModal from '../components/PersonalModal';
import ProgressBar from '../components/ProgressBar';
import TeamMemberFilter from '../components/TeamMemberFilter';
import { apiFetch, type SubProject, type UserBrief } from '../lib/api';
import { useMe } from '../lib/useMe';
import { useWorkflowSelection } from '../lib/workflow-selection';

export default function PersonalCalendarPage() {
  const { me, loading: meLoading } = useMe();
  const { selectedMemberId, setSelectedMemberId } = useWorkflowSelection();
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
        const us =
          me.role === 'admin'
            ? await apiFetch<UserBrief[]>('/users')
            : [me];
        setUsers(us);
        setSelectedUserId(selectedMemberId ?? me.id);
      } catch (err) {
        setError((err as Error).message);
      }
    })();
  }, [me, selectedMemberId]);

  useEffect(() => {
    if (selectedMemberId !== null) {
      setSelectedUserId(selectedMemberId);
    }
  }, [selectedMemberId]);

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
    return <main className="p-8 text-text">불러오는 중...</main>;
  }

  return (
    <AppShell
      me={me}
      selectedMemberId={selectedUserId}
      onMemberSelect={(memberId) => {
        setSelectedUserId(memberId);
        setSelectedMemberId(memberId);
      }}
      sidebarUsers={users}
    >
      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      {/* 팀원 필터 — 팀 단위로 접이식 */}
      <div className="mb-4 rounded-2xl border border-[#EAEAE4] bg-white p-4 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-body font-semibold text-[#1A1A1A]">담당자 선택</h2>
          <span className="text-micro text-[#888780]">
            {users.length}명 중 1명
          </span>
        </div>
        <TeamMemberFilter
          users={users}
          selectedId={selectedUserId}
          onSelect={(id) => {
            if (id === null) return;
            setSelectedUserId(id);
            setSelectedMemberId(id);
          }}
          myTeam={me.team}
          singleSelection
        />
      </div>

      {selectedUserId === null ? (
        <p className="rounded-lg bg-surface-subtle px-4 py-6 text-center text-sm text-text-subtle">
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
            onSelectMonth={(nextYear, nextMonth) => setCursor(new Date(nextYear, nextMonth, 1))}
            onSelectSubProject={(sp) => setOpenSp(sp)}
          />

          <aside className="rounded-2xl border border-border bg-white p-4 shadow-sm">
            <h3 className="text-base font-semibold">담당 소프로젝트</h3>
            <p className="mt-1 text-xs text-text-faint">
              체크박스로 단계별 진척을 기록할 수 있습니다.
            </p>

            <div className="mt-3 max-h-[560px] space-y-2 overflow-y-auto">
              {loading && (
                <p className="py-4 text-center text-sm text-text-faint">
                  불러오는 중...
                </p>
              )}
              {!loading && orderedList.length === 0 && (
                <p className="py-4 text-center text-sm text-text-faint">
                  배정된 소프로젝트가 없습니다.
                </p>
              )}
              {orderedList.map((sp) => (
                <button
                  key={sp.id}
                  onClick={() => setOpenSp(sp)}
                  className="block w-full rounded-xl border border-border-subtle bg-surface-muted p-3 text-left hover:bg-surface-subtle"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{sp.name}</span>
                    {sp.status === 'completed' && (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-micro font-semibold text-emerald-700">
                        완료
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-micro text-text-subtle">
                    {sp.start_date} ~ {sp.end_date}
                  </div>
                  <ProgressBar
                    value={sp.progress}
                    className="mt-2"
                    ariaLabel={`${sp.name} 진척도`}
                  />
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
