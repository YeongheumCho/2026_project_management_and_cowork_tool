'use client';

import { useMemo, useRef, useState } from 'react';
import {
  fetchUserProjectHistory,
  type ProjectHistoryEntry,
  type UserCreatePayload,
  type UserResponse,
} from '../lib/adminApi';
import OrgChartView from './OrgChartView';
import UserRoleRow from './UserRoleRow';

const ORG_DATA = {
  centers: ['E-모빌리티센터'],
  offices: ['Automotive시스템실', 'E-모빌리티시스템실', 'SDV시스템실'],
  officeTeams: {
    'Automotive시스템실': ['Automotive검증1팀', 'Automotive검증2팀', 'Automotive검증3팀'],
    'E-모빌리티시스템실': ['E-모빌리티검증1팀', 'E-모빌리티검증2팀', 'E-모빌리티검증3팀'],
    'SDV시스템실': ['SDV솔루션1팀', 'SDV솔루션2팀', 'SDV솔루션3팀', 'SDV솔루션4팀'],
  } as Record<string, string[]>,
  allTeams: [
    'Automotive검증1팀', 'Automotive검증2팀', 'Automotive검증3팀',
    'E-모빌리티검증1팀', 'E-모빌리티검증2팀', 'E-모빌리티검증3팀',
    'SDV솔루션1팀', 'SDV솔루션2팀', 'SDV솔루션3팀', 'SDV솔루션4팀',
  ],
  positions: ['인턴', '전임연구원', '선임연구원', '책임연구원', '수석연구원', '이사'],
};

function ComboBox({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const [inputVal, setInputVal] = useState(value);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputVal(e.target.value);
    onChange(e.target.value);
    setOpen(true);
  };

  const handleSelect = (opt: string) => {
    setInputVal(opt);
    onChange(opt);
    setOpen(false);
  };

  const filtered = options.filter((opt) =>
    opt.toLowerCase().includes(inputVal.toLowerCase()),
  );

  return (
    <div ref={wrapperRef} className="relative">
      <input
        value={inputVal}
        onChange={handleInputChange}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-[#EAEAE4] bg-white px-3 py-2 text-[12px] focus:border-[#534AB7] focus:outline-none"
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-[#EAEAE4] bg-white shadow-lg">
          {filtered.map((opt) => (
            <li
              key={opt}
              onMouseDown={() => handleSelect(opt)}
              className={`cursor-pointer px-3 py-2 text-[12px] hover:bg-[#EEEDFE] hover:text-[#534AB7] ${
                opt === inputVal ? 'bg-[#EEEDFE] font-semibold text-[#534AB7]' : 'text-[#1A1A1A]'
              }`}
            >
              {opt}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ErrorModal({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="w-[320px] rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-3 flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#FFF4F4] text-[16px]">
            ⚠️
          </span>
          <h4 className="text-[14px] font-bold text-[#1A1A1A]">입력 오류</h4>
        </div>
        <p className="mb-5 whitespace-pre-line text-[13px] text-[#5F5E5A]">{message}</p>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-[#534AB7] px-5 py-2 text-[12px] font-semibold text-white hover:bg-[#43399C]"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}

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
  onPasswordReset: (member: UserResponse, newPassword: string) => Promise<boolean>;
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
  onPasswordReset,
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
      const haystack = [user.name, user.idnum, user.center, user.office, user.team, user.position]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [users, query, roleFilter]);

  const adminCount = useMemo(
    () => users.filter((u) => u.role === 'admin').length,
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
            {(['table', 'org'] as ViewMode[]).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setViewMode(v)}
                className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${
                  viewMode === v
                    ? 'bg-white text-[#534AB7] shadow-sm'
                    : 'text-[#888780] hover:text-[#1A1A1A]'
                }`}
              >
                {v === 'table' ? '테이블' : '조직도'}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 rounded-full border border-[#EAEAE4] bg-[#FAFAFA] p-0.5">
            {(['all', 'admin', 'member'] as RoleFilter[]).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setRoleFilter(v)}
                className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${
                  roleFilter === v
                    ? 'bg-white text-[#534AB7] shadow-sm'
                    : 'text-[#888780] hover:text-[#1A1A1A]'
                }`}
              >
                {v === 'all' ? '전체' : v === 'admin' ? '관리자' : '일반'}
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
                  <th className="py-2">관리</th>
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
                    onPasswordReset={onPasswordReset}
                  />
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <p className="py-8 text-center text-[12px] text-[#888780]">
                {users.length === 0 ? '등록된 사용자가 없습니다.' : '검색 조건에 맞는 사용자가 없습니다.'}
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
            onPasswordReset={onPasswordReset}
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

function CreateUserPanel({ onCreate }: { onCreate: (payload: UserCreatePayload) => Promise<boolean> }) {
  const [form, setForm] = useState<UserCreatePayload>({
    idnum: '', name: '', password: '', role: 'member',
    center: '', office: '', team: '', position: '', email: '', phone: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [errorModal, setErrorModal] = useState<string | null>(null);

  const updateField = (key: keyof UserCreatePayload, value: string) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'office') next.team = '';
      return next;
    });
  };

  const handleIdnumChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    updateField('idnum', val);
    if (val.length > 9) {
      setErrorModal('사번 기입이 잘못되었습니다.\n사번은 9자리 이하로 입력해 주세요.');
    }
  };

  const handleSubmit = async () => {
    if (form.idnum.trim().length > 9) {
      setErrorModal('사번 기입이 잘못되었습니다.\n사번은 9자리 이하로 입력해 주세요.');
      return;
    }
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
    setForm({ idnum: '', name: '', password: '', role: 'member', center: '', office: '', team: '', position: '', email: '', phone: '' });
  };

  const isIdnumInvalid = form.idnum.length > 9;

  return (
    <>
      {errorModal && <ErrorModal message={errorModal} onClose={() => setErrorModal(null)} />}
      <div className="mt-4 rounded-2xl border border-[#EAEAE4] bg-[#FAFAFA] p-4">
        <div className="mb-3">
          <h4 className="text-[13px] font-bold text-[#1A1A1A]">사용자 추가</h4>
          <p className="mt-1 text-[11px] text-[#888780]">
            사번, 이름, 비밀번호를 입력하고 필요하면 조직 정보를 함께 설정하세요.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="flex flex-col gap-1">
            <input
              value={form.idnum}
              onChange={handleIdnumChange}
              placeholder="사번 (9자리 이하)"
              maxLength={20}
              className={`rounded-lg border bg-white px-3 py-2 text-[12px] focus:outline-none ${
                isIdnumInvalid ? 'border-[#E05C5C] focus:border-[#E05C5C]' : 'border-[#EAEAE4] focus:border-[#534AB7]'
              }`}
            />
            {isIdnumInvalid && (
              <span className="text-[11px] text-[#E05C5C]">사번 기입이 잘못되었습니다.</span>
            )}
          </div>
          <input
            value={form.name}
            onChange={(e) => updateField('name', e.target.value)}
            placeholder="이름"
            className="rounded-lg border border-[#EAEAE4] bg-white px-3 py-2 text-[12px] focus:border-[#534AB7] focus:outline-none"
          />
          <input
            value={form.password}
            onChange={(e) => updateField('password', e.target.value)}
            placeholder="초기 비밀번호"
            type="password"
            className="rounded-lg border border-[#EAEAE4] bg-white px-3 py-2 text-[12px] focus:border-[#534AB7] focus:outline-none"
          />
          <select
            value={form.role}
            onChange={(e) => updateField('role', e.target.value)}
            className="rounded-lg border border-[#EAEAE4] bg-white px-3 py-2 text-[12px] focus:border-[#534AB7] focus:outline-none"
          >
            <option value="member">일반</option>
            <option value="admin">관리자</option>
          </select>
          <ComboBox
            value={form.center ?? ''}
            onChange={(v) => updateField('center', v)}
            options={ORG_DATA.centers}
            placeholder="센터"
          />
          <ComboBox
            value={form.office ?? ''}
            onChange={(v) => updateField('office', v)}
            options={ORG_DATA.offices}
            placeholder="실"
          />
          <ComboBox
            value={form.team ?? ''}
            onChange={(v) => updateField('team', v)}
            options={form.office ? (ORG_DATA.officeTeams[form.office] ?? []) : ORG_DATA.allTeams}
            placeholder="팀"
          />
          <ComboBox
            value={form.position ?? ''}
            onChange={(v) => updateField('position', v)}
            options={ORG_DATA.positions}
            placeholder="직급"
          />
          <input
            value={form.email ?? ''}
            onChange={(e) => updateField('email', e.target.value)}
            placeholder="이메일"
            className="rounded-lg border border-[#EAEAE4] bg-white px-3 py-2 text-[12px] focus:border-[#534AB7] focus:outline-none"
          />
          <input
            value={form.phone ?? ''}
            onChange={(e) => updateField('phone', e.target.value)}
            placeholder="전화번호"
            className="rounded-lg border border-[#EAEAE4] bg-white px-3 py-2 text-[12px] focus:border-[#534AB7] focus:outline-none"
          />
        </div>
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={submitting || !form.idnum.trim() || !form.name.trim() || !form.password.trim() || isIdnumInvalid}
            className="rounded-lg bg-[#534AB7] px-4 py-2 text-[12px] font-semibold text-white transition hover:bg-[#43399C] disabled:cursor-not-allowed disabled:bg-[#D3D1C7]"
          >
            {submitting ? '추가 중...' : '사용자 추가'}
          </button>
        </div>
      </div>
    </>
  );
}

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}분`;
  if (m === 0) return `${h}시간`;
  return `${h}시간 ${m}분`;
}

function UserHistoryPanel({
  user, items, loading, error, onClose,
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
          <h4 className="text-[15px] font-bold text-[#1A1A1A]">{user.name}님 수행 업무 이력</h4>
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
        <p className="mt-4 rounded-xl bg-[#FFF4F4] px-4 py-3 text-[12px] text-[#A32D2D]">{error}</p>
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
                  <td className="py-3 pr-4 text-[#5F5E5A]">{item.completion_rate}%</td>
                  <td className="py-3 text-[#5F5E5A]">{item.ended_on ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
