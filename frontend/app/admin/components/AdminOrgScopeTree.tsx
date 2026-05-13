'use client';

import OrganizationMemberPicker from '../../components/OrganizationMemberPicker';
import type { UserBrief } from '../../lib/api';

type Props = {
  users: Array<{
    id: number;
    idnum: string;
    name: string;
    role: string;
    center?: string | null;
    office?: string | null;
    team?: string | null;
    position?: string | null;
    email?: string | null;
    phone?: string | null;
  }>;
  selectedIds: Set<number> | null;
  onSelect: (ids: Set<number> | null) => void;
};

export default function AdminOrgScopeTree({
  users,
  selectedIds,
  onSelect,
}: Props) {
  const selectedArray = selectedIds ? Array.from(selectedIds) : [];
  const pickerUsers: UserBrief[] = users.map((user) => ({
    ...user,
    role: user.role === 'admin' ? 'admin' : 'member',
  })) as UserBrief[];

  return (
    <section className="rounded-2xl border border-[#EAEAE4] bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-md font-bold text-[#1A1A1A]">담당자</h3>
          <p className="mt-1 text-small text-[#888780]">
            선택 범위: {selectedIds ? `${selectedIds.size}명` : '전체'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onSelect(null)}
          className={`rounded-full border px-3 py-1 text-micro font-bold ${
            selectedIds === null
              ? 'border-[#534AB7] bg-[#EEEDFE] text-[#534AB7]'
              : 'border-[#EAEAE4] bg-white text-[#66645C] hover:bg-[#FAFAFA]'
          }`}
        >
          전체 보기
        </button>
      </div>

      <div className="max-h-[300px] overflow-y-auto pr-1">
        <OrganizationMemberPicker
          users={pickerUsers}
          selectedIds={selectedArray}
          onChange={(nextIds) =>
            onSelect(nextIds.length === 0 ? null : new Set(nextIds))
          }
          emptyLabel="선택 가능한 인원이 없습니다."
        />
      </div>
    </section>
  );
}
