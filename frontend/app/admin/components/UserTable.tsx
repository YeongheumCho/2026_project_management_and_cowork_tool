'use client';

import { useMemo, useState } from 'react';
import {
  fetchUserProjectHistory,
  type ProjectHistoryEntry,
  type UserCreatePayload,
  type UserResponse,
} from '../lib/adminApi';
import OrgChartView from './OrgChartView';
import UserRoleRow from './UserRoleRow';

type Props = {
  users: UserResponse[];
  canEdit: boolean;
  savingId: string | null;
  deletingId: string | null;
  message: string | null;
  onRoleChange: (idnum: string, role: string) => void;
  onRoleSave: (member: UserResponse) => void;
  onUserCreate: (payload: UserCreatePayload) => Promise<boolean>;
  onUserDelete: (member: UserResponse) => void;
};

type RoleFilter = 'all' | 'admin' | 'member';
type ViewMode = 'table' | 'org';

export default function UserTable({
  users,
  canEdit,
  savingId,
  deletingId,
  message,
  onRoleChange,
  onRoleSave,
  onUserCreate,
  onUserDelete,
}: Props) {
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('org');
  const [selectedHistoryUser, setSelectedHistoryUser] = useState<UserResponse | null>(null);
  const [historyItems, setHistoryItems] = useState<ProjectHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return users.filter((user) => {
      if (roleFilter !== 'all' && user.role !== roleFilter) return false;
      if (!needle) return true;

      const haystack = [
        user.name,
        user.idnum,
        user.center,
        user.office,
        user.team,
        user.position,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(needle);
    });
  }, [users, query, roleFilter]);

  const adminCount = useMemo(
    () => users.filter((user) => user.role === 'admin').length,
    [users],
  );

  const handleDelete = (member: UserResponse) => {
    if (!window.confirm(`${member.name}님 계정을 삭제하시겠습니까?`)) return;
    onUserDelete(member);
  };

  const handleOpenHistory = async (member: UserResponse) => {
    const token = window.localStorage.getItem('access_token');
    if (!token) return;

    setSelectedHistoryUser(member);
    setHistoryLoading(true);
    setHistoryError('');
    try {
      const res = await fetchUserProjectHistory({ token }, member.id);
      const data = (await res.json()) as ProjectHistoryEntry[] | { detail?: string };
      if (!res.ok) {
        setHistoryItems([]);
        setHistoryError(
          typeof data === 'object' && !Array.isArray(data) && data.detail
            ? data.detail
            : '수행 이력을 불러오지 못했습니다.',
        );
        return;
      }
      setHistoryItems(Array.isArray(data) ? data : []);
    } catch {
      setHistoryItems([]);
      setHistoryError('수행 이력을 불러오지 못했습니다.');
    } finally {
      setHistoryLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-[#EAEAE4] bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-[15px] font-bold text-[#1A1A1A]">사용자 권한 관리</h3>
          <p className="mt-0.5 text-[11px] text-[#888780]">
            전체 {users.length}명 중 관리자 {adminCount}명
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-full border border-[#EAEAE4] bg-[#FAFAFA] p-0.5">
            {(['table', 'org'] as ViewMode[]).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setViewMode(value)}
                className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${
                  viewMode === value
                    ? 'bg-white text-[#534AB7] shadow-sm'
                    : 'text-[#888780] hover:text-[#1A1A1A]'
                }`}
              >
                {value === 'table' ? '테이블' : '조직도'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 rounded-full border border-[#EAEAE4] bg-[#FAFAFA] p-0.5">
            {(['all', 'admin', 'member'] as RoleFilter[]).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setRoleFilter(value)}
                className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${
                  roleFilter === value
                    ? 'bg-white text-[#534AB7] shadow-sm'
                    : 'text-[#888780] hover:text-[#1A1A1A]'
                }`}
              >
                {value === 'all' ? '전체' : value === 'admin' ? '관리자' : '일반'}
              </button>
            ))}
          </div>

          <input
            type="search"
            placeholder="이름, 사번, 소속 검색"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-[220px] rounded-lg border border-[#EAEAE4] px-3 py-1.5 text-[12px] text-[#1A1A1A] placeholder:text-[#B4B2A9] focus:border-[#534AB7] focus:outline-none"
          />
        </div>
      </div>

      <CreateUserPanel onCreate={onUserCreate} />

      {message && (
        <p className="mt-3 rounded-lg bg-[#EEEDFE] px-3 py-2 text-[12px] text-[#534AB7]">
          {message}
        </p>
      )}

      <div className="mt-4">
        {viewMode === 'table' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[12px]">
              <thead className="border-b border-[#EAEAE4] text-[10px] font-bold uppercase tracking-[1px] text-[#888780]">
                <tr>
                  <th className="py-2 pr-4">이름</th>
                  <th className="py-2 pr-4">사번</th>
                  <th className="py-2 pr-4">소속</th>
                  <th className="py-2 pr-4">권한</th>
                  <th className="py-2 pr-4">상태</th>
                  <th className="py-2">저장</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((member) => (
                  <UserRoleRow
                    key={member.idnum}
                    member={member}
                    canEdit={canEdit}
                    savingId={savingId}
                    deletingId={deletingId}
                    onRoleChange={onRoleChange}
                    onRoleSave={onRoleSave}
                    onDelete={handleDelete}
                    onOpenHistory={handleOpenHistory}
                  />
                ))}
              </tbody>
            </table>

            {filtered.length === 0 && (
              <p className="py-8 text-center text-[12px] text-[#888780]">
                {users.length === 0
                  ? '등록된 사용자가 없습니다.'
                  : '검색 조건에 맞는 사용자가 없습니다.'}
              </p>
            )}
          </div>
        ) : (
          <OrgChartView
            users={filtered}
            canEdit={canEdit}
            savingId={savingId}
            deletingId={deletingId}
            onRoleChange={onRoleChange}
            onRoleSave={onRoleSave}
            onDelete={handleDelete}
            onOpenHistory={handleOpenHistory}
          />
        )}
      </div>

      {selectedHistoryUser && (
        <UserHistoryPanel
          user={selectedHistoryUser}
          items={historyItems}
          loading={historyLoading}
          error={historyError}
          onClose={() => {
            setSelectedHistoryUser(null);
            setHistoryItems([]);
            setHistoryError('');
          }}
        />
      )}
    </div>
  );
}

function CreateUserPanel({
  onCreate,
}: {
  onCreate: (payload: UserCreatePayload) => Promise<boolean>;
}) {
  const [form, setForm] = useState<UserCreatePayload>({
    idnum: '',
    name: '',
    password: '',
    role: 'member',
    center: '',
    office: '',
    team: '',
    position: '',
    email: '',
    phone: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const updateField = (key: keyof UserCreatePayload, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    if (!form.idnum.trim() || !form.name.trim() || !form.password.trim()) return;
    setSubmitting(true);
    const ok = await onCreate({
      ...form,
      idnum: form.idnum.trim(),
      name: form.name.trim(),
      password: form.password.trim(),
      center: form.center?.trim() || null,
      office: form.office?.trim() || null,
      team: form.team?.trim() || null,
      position: form.position?.trim() || null,
      email: form.email?.trim() || null,
      phone: form.phone?.trim() || null,
    });
    setSubmitting(false);
    if (!ok) return;
    setForm({
      idnum: '',
      name: '',
      password: '',
      role: 'member',
      center: '',
      office: '',
      team: '',
      position: '',
      email: '',
      phone: '',
    });
  };

  return (
    <div className="mt-4 rounded-2xl border border-[#EAEAE4] bg-[#FAFAFA] p-4">
      <div className="mb-3">
        <h4 className="text-[13px] font-bold text-[#1A1A1A]">사용자 추가</h4>
        <p className="mt-1 text-[11px] text-[#888780]">
          사번, 이름, 비밀번호를 입력하고 필요하면 조직 정보를 함께 설정하세요.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <input value={form.idnum} onChange={(e) => updateField('idnum', e.target.value)} placeholder="사번" className="rounded-lg border border-[#EAEAE4] bg-white px-3 py-2 text-[12px] focus:border-[#534AB7] focus:outline-none" />
        <input value={form.name} onChange={(e) => updateField('name', e.target.value)} placeholder="이름" className="rounded-lg border border-[#EAEAE4] bg-white px-3 py-2 text-[12px] focus:border-[#534AB7] focus:outline-none" />
        <input value={form.password} onChange={(e) => updateField('password', e.target.value)} placeholder="초기 비밀번호" type="password" className="rounded-lg border border-[#EAEAE4] bg-white px-3 py-2 text-[12px] focus:border-[#534AB7] focus:outline-none" />
        <select value={form.role} onChange={(e) => updateField('role', e.target.value)} className="rounded-lg border border-[#EAEAE4] bg-white px-3 py-2 text-[12px] focus:border-[#534AB7] focus:outline-none">
          <option value="member">일반</option>
          <option value="admin">관리자</option>
        </select>
        <input value={form.center ?? ''} onChange={(e) => updateField('center', e.target.value)} placeholder="센터" className="rounded-lg border border-[#EAEAE4] bg-white px-3 py-2 text-[12px] focus:border-[#534AB7] focus:outline-none" />
        <input value={form.office ?? ''} onChange={(e) => updateField('office', e.target.value)} placeholder="실" className="rounded-lg border border-[#EAEAE4] bg-white px-3 py-2 text-[12px] focus:border-[#534AB7] focus:outline-none" />
        <input value={form.team ?? ''} onChange={(e) => updateField('team', e.target.value)} placeholder="팀" className="rounded-lg border border-[#EAEAE4] bg-white px-3 py-2 text-[12px] focus:border-[#534AB7] focus:outline-none" />
        <input value={form.position ?? ''} onChange={(e) => updateField('position', e.target.value)} placeholder="직급" className="rounded-lg border border-[#EAEAE4] bg-white px-3 py-2 text-[12px] focus:border-[#534AB7] focus:outline-none" />
        <input value={form.email ?? ''} onChange={(e) => updateField('email', e.target.value)} placeholder="이메일" className="rounded-lg border border-[#EAEAE4] bg-white px-3 py-2 text-[12px] focus:border-[#534AB7] focus:outline-none" />
        <input value={form.phone ?? ''} onChange={(e) => updateField('phone', e.target.value)} placeholder="전화번호" className="rounded-lg border border-[#EAEAE4] bg-white px-3 py-2 text-[12px] focus:border-[#534AB7] focus:outline-none" />
      </div>
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={submitting || !form.idnum.trim() || !form.name.trim() || !form.password.trim()}
          className="rounded-lg bg-[#534AB7] px-4 py-2 text-[12px] font-semibold text-white transition hover:bg-[#43399C] disabled:cursor-not-allowed disabled:bg-[#D3D1C7]"
        >
          {submitting ? '추가 중...' : '사용자 추가'}
        </button>
      </div>
    </div>
  );
}

function UserHistoryPanel({
  user,
  items,
  loading,
  error,
  onClose,
}: {
  user: UserResponse;
  items: ProjectHistoryEntry[];
  loading: boolean;
  error: string;
  onClose: () => void;
}) {
  return (
    <div className="mt-4 rounded-2xl border border-[#EAEAE4] bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-[15px] font-bold text-[#1A1A1A]">
            {user.name}님 수행 업무 이력
          </h4>
          <p className="mt-1 text-[11px] text-[#888780]">
            {user.center || '미지정'} / {user.office || '미지정'} / {user.team || '미지정'}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-[#D3D1C7] px-3 py-1.5 text-[11px] font-semibold text-[#5F5E5A]"
        >
          닫기
        </button>
      </div>

      {loading && (
        <p className="mt-4 rounded-xl bg-[#FAFAFA] px-4 py-6 text-center text-[12px] text-[#888780]">
          수행 이력을 불러오는 중입니다.
        </p>
      )}

      {!loading && error && (
        <p className="mt-4 rounded-xl bg-[#FFF4F4] px-4 py-3 text-[12px] text-[#A32D2D]">
          {error}
        </p>
      )}

      {!loading && !error && items.length === 0 && (
        <p className="mt-4 rounded-xl bg-[#FAFAFA] px-4 py-6 text-center text-[12px] text-[#888780]">
          아직 기록된 수행 이력이 없습니다.
        </p>
      )}

      {!loading && !error && items.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-[12px]">
            <thead className="border-b border-[#EAEAE4] text-[10px] font-bold uppercase tracking-[1px] text-[#888780]">
              <tr>
                <th className="py-2 pr-4">프로젝트</th>
                <th className="py-2 pr-4">소프로젝트</th>
                <th className="py-2 pr-4">유형</th>
                <th className="py-2 pr-4">투입 시간</th>
                <th className="py-2 pr-4">완료율</th>
                <th className="py-2">완료일</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-[#F1EFE8]">
                  <td className="py-3 pr-4 text-[#1A1A1A]">{item.project_name}</td>
                  <td className="py-3 pr-4 text-[#5F5E5A]">{item.subproject_name}</td>
                  <td className="py-3 pr-4 text-[#5F5E5A]">{item.project_type}</td>
                  <td className="py-3 pr-4 text-[#5F5E5A]">{formatMinutes(item.worked_minutes)}</td>
                  <td className="py-3 pr-4 text-[#5F5E5A]">{Math.round(item.completion_rate)}%</td>
                  <td className="py-3 text-[#5F5E5A]">{item.ended_on ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function formatMinutes(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}분`;
  if (minutes === 0) return `${hours}시간`;
  return `${hours}시간 ${minutes}분`;
}
