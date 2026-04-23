'use client';

import { useEffect, useMemo, useState } from 'react';
import type { UserBrief } from '../lib/api';
import {
  groupUsersByTeam,
  initialExpandedKeys,
} from './AppShell/groupUsersByTeam';
import {
  colorForId,
  softColorForId,
  textColorForId,
} from './AppShell/colors';

type Props = {
  users: UserBrief[];
  /** 현재 선택된 사용자 id — null 이면 "전체" */
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  /** 로그인 사용자의 팀명 — 이 팀이 기본 펼침 */
  myTeam?: string | null;
  /** "전체" 버튼을 보여줄지 여부. 기본 true. */
  showAll?: boolean;
  allLabel?: string;
  /** 한 명을 꼭 선택해야 할 때(개인 캘린더처럼 null 을 "전체" 로 쓰지 않는 경우) true */
  singleSelection?: boolean;
  className?: string;
};

/**
 * 캘린더 담당자 필터 공통 UI.
 *
 * - users 는 팀 단위로 그룹핑되어 접이식으로 표시된다.
 * - 내 팀(myTeam) 이 기본 펼침. 나머지는 접힘.
 * - 선택된 멤버가 접혀있는 그룹에 있으면 자동으로 펼친다.
 * - showAll=true(기본) 면 "전체" 칩이 맨 앞에 붙는다 — null 선택으로 매핑.
 * - singleSelection=true 면 "전체" 칩은 숨기고, 선택된 멤버만 하이라이트.
 */
export default function TeamMemberFilter({
  users,
  selectedId,
  onSelect,
  myTeam,
  showAll = true,
  allLabel = '전체',
  singleSelection = false,
  className,
}: Props) {
  const groups = useMemo(() => groupUsersByTeam(users), [users]);

  const [expanded, setExpanded] = useState<Set<string>>(() =>
    initialExpandedKeys(groups, myTeam),
  );

  // users 가 나중에 채워지는 경우 기본 펼침 재계산
  useEffect(() => {
    setExpanded((current) => {
      if (current.size > 0) return current;
      return initialExpandedKeys(groups, myTeam);
    });
  }, [groups, myTeam]);

  // 선택된 멤버가 접힌 그룹에 있으면 자동 펼침
  useEffect(() => {
    if (selectedId == null) return;
    const hit = groups.find((group) =>
      group.members.some((member) => member.id === selectedId),
    );
    if (!hit) return;
    setExpanded((current) => {
      if (current.has(hit.key)) return current;
      const next = new Set(current);
      next.add(hit.key);
      return next;
    });
  }, [groups, selectedId]);

  const toggleGroup = (key: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const effectiveShowAll = showAll && !singleSelection;

  return (
    <div className={`space-y-1.5 ${className ?? ''}`}>
      {effectiveShowAll && (
        <button
          type="button"
          onClick={() => onSelect(null)}
          className={`rounded-full border px-[9px] py-1 text-[11px] ${
            selectedId === null
              ? 'border-[#534AB7] bg-[#EEEDFE] text-[#534AB7]'
              : 'border-[#EAEAE4] text-[#888780]'
          }`}
        >
          {allLabel}
        </button>
      )}

      <div className="space-y-1.5">
        {groups.map((group) => {
          const isOpen = expanded.has(group.key);
          const selectedInGroup = group.members.some(
            (member) => member.id === selectedId,
          );
          return (
            <div key={group.key} className="space-y-1">
              <button
                type="button"
                onClick={() => toggleGroup(group.key)}
                aria-expanded={isOpen}
                className={`inline-flex items-center gap-1.5 rounded-full border px-[9px] py-1 text-[11px] ${
                  selectedInGroup
                    ? 'border-[#534AB7] bg-[#EEEDFE] text-[#534AB7]'
                    : 'border-[#EAEAE4] text-[#888780] hover:bg-[#FAFAFA]'
                }`}
              >
                <span
                  className={`inline-block text-[9px] transition-transform ${
                    isOpen ? 'rotate-90' : ''
                  }`}
                  aria-hidden
                >
                  ▶
                </span>
                <span>{group.label}</span>
                <span className="text-[10px] opacity-70">
                  {group.members.length}
                </span>
              </button>

              {isOpen && (
                <div className="flex flex-wrap gap-[5px] pl-4">
                  {group.members.map((user) => {
                    const active = user.id === selectedId;
                    return (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => onSelect(user.id)}
                        className={`inline-flex items-center gap-1 rounded-full border px-[9px] py-1 text-[11px] ${
                          active
                            ? `${softColorForId(user.id)} ${textColorForId(user.id)} border-transparent`
                            : 'border-[#EAEAE4] text-[#888780] hover:bg-[#FAFAFA]'
                        }`}
                      >
                        <span
                          className={`h-[6px] w-[6px] rounded-full ${colorForId(user.id)}`}
                        />
                        {user.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
