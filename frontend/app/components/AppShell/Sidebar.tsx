'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { Project, UserBrief } from '../../lib/api';
import { colorForId } from './colors';
import {
  groupUsersByTeam,
  initialExpandedKeys,
  type TeamGroup,
} from './groupUsersByTeam';

type Props = {
  projects: Project[];
  users: UserBrief[];
  /** 로그인 사용자의 팀명 — 이 팀이 기본 펼침 */
  myTeam?: string | null;
  selectedProjectId?: number | null;
  selectedMemberId?: number | null;
  onProjectSelect?: (projectId: number) => void;
  onMemberSelect?: (memberId: number) => void;
};

export default function Sidebar({
  projects,
  users,
  myTeam,
  selectedProjectId,
  selectedMemberId,
  onProjectSelect,
  onMemberSelect,
}: Props) {
  const groups = useMemo(() => groupUsersByTeam(users), [users]);

  const [expanded, setExpanded] = useState<Set<string>>(() =>
    initialExpandedKeys(groups, myTeam),
  );

  // 사용자 목록이 비동기로 나중에 채워지는 경우 기본 펼침 상태도 다시 맞춰준다.
  useEffect(() => {
    setExpanded((current) => {
      if (current.size > 0) return current;
      return initialExpandedKeys(groups, myTeam);
    });
  }, [groups, myTeam]);

  // 선택된 멤버가 속한 팀이 접혀있으면 자동으로 펼쳐준다.
  useEffect(() => {
    if (selectedMemberId == null) return;
    const selectedGroup = groups.find((group) =>
      group.members.some((member) => member.id === selectedMemberId),
    );
    if (!selectedGroup) return;
    setExpanded((current) => {
      if (current.has(selectedGroup.key)) return current;
      const next = new Set(current);
      next.add(selectedGroup.key);
      return next;
    });
  }, [groups, selectedMemberId]);

  const toggleGroup = (key: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <aside className="hidden w-[210px] shrink-0 border-r border-[#EAEAE4] bg-white lg:block">
      <div className="h-full overflow-y-auto px-[10px] py-[14px]">
        <Section title="프로젝트">
          {projects.length === 0 ? (
            <EmptyHint text="아직 프로젝트가 없습니다." />
          ) : (
            <ul className="space-y-1">
              {projects.map((project) => (
                <li key={project.id}>
                  {onProjectSelect ? (
                    <button
                      type="button"
                      onClick={() => onProjectSelect(project.id)}
                      className={itemClass(selectedProjectId === project.id)}
                    >
                      <span className={`h-[7px] w-[7px] shrink-0 rounded-full ${colorForId(project.id)}`} />
                      <span className="truncate">{project.name}</span>
                    </button>
                  ) : (
                    <Link
                      href={`/projects/${project.id}`}
                      className={itemClass(false)}
                    >
                      <span className={`h-[7px] w-[7px] shrink-0 rounded-full ${colorForId(project.id)}`} />
                      <span className="truncate">{project.name}</span>
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="팀원" className="mt-6">
          {groups.length === 0 ? (
            <EmptyHint text="표시할 팀원이 없습니다." />
          ) : (
            <ul className="space-y-1">
              {groups.map((group) => (
                <TeamGroupItem
                  key={group.key}
                  group={group}
                  expanded={expanded.has(group.key)}
                  onToggle={() => toggleGroup(group.key)}
                  selectedMemberId={selectedMemberId}
                  onMemberSelect={onMemberSelect}
                />
              ))}
            </ul>
          )}
        </Section>
      </div>
    </aside>
  );
}

function TeamGroupItem({
  group,
  expanded,
  onToggle,
  selectedMemberId,
  onMemberSelect,
}: {
  group: TeamGroup;
  expanded: boolean;
  onToggle: () => void;
  selectedMemberId?: number | null;
  onMemberSelect?: (memberId: number) => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-[11px] font-semibold text-[#5F5E5A] transition hover:bg-[#FAFAFA]"
      >
        <span
          className={`inline-block text-[9px] text-[#888780] transition-transform ${
            expanded ? 'rotate-90' : ''
          }`}
          aria-hidden
        >
          ▶
        </span>
        <span className="flex-1 truncate">{group.label}</span>
        <span className="shrink-0 text-[10px] font-medium text-[#B4B2A9]">
          {group.members.length}
        </span>
      </button>
      {expanded && (
        <ul className="mt-0.5 space-y-0.5 pl-4">
          {group.members.map((user) => (
            <li key={user.id}>
              {onMemberSelect ? (
                <button
                  type="button"
                  onClick={() => onMemberSelect(user.id)}
                  className={itemClass(selectedMemberId === user.id)}
                >
                  <span className={`h-[7px] w-[7px] shrink-0 rounded-full ${colorForId(user.id)}`} />
                  <span className="truncate">{user.name}</span>
                  {user.position && (
                    <span className="ml-auto shrink-0 text-[10px] text-[#B4B2A9]">
                      {user.position}
                    </span>
                  )}
                </button>
              ) : (
                <div className={itemClass(false)}>
                  <span className={`h-[7px] w-[7px] shrink-0 rounded-full ${colorForId(user.id)}`} />
                  <span className="truncate">{user.name}</span>
                  {user.position && (
                    <span className="ml-auto shrink-0 text-[10px] text-[#B4B2A9]">
                      {user.position}
                    </span>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function Section({
  title,
  children,
  className = '',
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="mb-1 px-2 text-[9px] font-bold uppercase tracking-[1px] text-[#888780]">
        {title}
      </p>
      {children}
    </div>
  );
}

function EmptyHint({ text }: { text: string }) {
  return <p className="px-2 text-[11px] text-[#B4B2A9]">{text}</p>;
}

function itemClass(active: boolean) {
  return `flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] transition ${
    active
      ? 'bg-[#F1EFE8] font-semibold text-[#1A1A1A]'
      : 'font-medium text-[#5F5E5A] hover:bg-[#FAFAFA]'
  }`;
}
