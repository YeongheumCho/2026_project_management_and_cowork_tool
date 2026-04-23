'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { Project, UserBrief } from '../../lib/api';
import { colorForId } from './colors';
import {
  expandedKeysForMember,
  groupUsersByTeam,
  initialExpandedKeys,
  type CenterGroup,
  type OfficeGroup,
  type TeamGroup,
} from './groupUsersByTeam';

type Props = {
  projects: Project[];
  users: UserBrief[];
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

  useEffect(() => {
    setExpanded((current) => {
      if (current.size > 0) return current;
      return initialExpandedKeys(groups, myTeam);
    });
  }, [groups, myTeam]);

  useEffect(() => {
    if (selectedMemberId == null) return;
    const keys = expandedKeysForMember(groups, selectedMemberId);
    if (keys.length === 0) return;

    setExpanded((current) => {
      const next = new Set(current);
      let changed = false;
      for (const key of keys) {
        if (!next.has(key)) {
          next.add(key);
          changed = true;
        }
      }
      return changed ? next : current;
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
    <aside className="hidden w-[240px] shrink-0 border-r border-[#EAEAE4] bg-white lg:block">
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
                    <Link href={`/projects/${project.id}`} className={itemClass(false)}>
                      <span className={`h-[7px] w-[7px] shrink-0 rounded-full ${colorForId(project.id)}`} />
                      <span className="truncate">{project.name}</span>
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="조직도" className="mt-6">
          {groups.length === 0 ? (
            <EmptyHint text="표시할 사용자가 없습니다." />
          ) : (
            <ul className="space-y-1">
              {groups.map((center) => (
                <CenterGroupItem
                  key={center.key}
                  center={center}
                  expanded={expanded}
                  onToggle={toggleGroup}
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

function CenterGroupItem({
  center,
  expanded,
  onToggle,
  selectedMemberId,
  onMemberSelect,
}: {
  center: CenterGroup;
  expanded: Set<string>;
  onToggle: (key: string) => void;
  selectedMemberId?: number | null;
  onMemberSelect?: (memberId: number) => void;
}) {
  const isOpen = expanded.has(center.key);
  const memberCount =
    center.members.length +
    center.offices.reduce(
      (sum, office) =>
        sum +
        office.members.length +
        office.teams.reduce((teamSum, team) => teamSum + team.members.length, 0),
      0,
    );

  return (
    <li>
      <HierarchyButton
        label={center.label}
        count={memberCount}
        expanded={isOpen}
        onClick={() => onToggle(center.key)}
      />
      {isOpen && (
        <div className="mt-0.5 space-y-0.5 pl-4">
          {center.members.length > 0 && (
            <MemberList
              members={center.members}
              selectedMemberId={selectedMemberId}
              onMemberSelect={onMemberSelect}
            />
          )}
          {center.offices.map((office) => (
            <OfficeGroupItem
              key={office.key}
              office={office}
              expanded={expanded}
              onToggle={onToggle}
              selectedMemberId={selectedMemberId}
              onMemberSelect={onMemberSelect}
            />
          ))}
        </div>
      )}
    </li>
  );
}

function OfficeGroupItem({
  office,
  expanded,
  onToggle,
  selectedMemberId,
  onMemberSelect,
}: {
  office: OfficeGroup;
  expanded: Set<string>;
  onToggle: (key: string) => void;
  selectedMemberId?: number | null;
  onMemberSelect?: (memberId: number) => void;
}) {
  const isOpen = expanded.has(office.key);
  const memberCount =
    office.members.length +
    office.teams.reduce((sum, team) => sum + team.members.length, 0);

  return (
    <div>
      <HierarchyButton
        label={office.label}
        count={memberCount}
        expanded={isOpen}
        onClick={() => onToggle(office.key)}
        className="text-[10.5px]"
      />
      {isOpen && (
        <div className="mt-0.5 space-y-0.5 pl-4">
          {office.members.length > 0 && (
            <MemberList
              members={office.members}
              selectedMemberId={selectedMemberId}
              onMemberSelect={onMemberSelect}
            />
          )}
          {office.teams.map((team) => (
            <TeamGroupItem
              key={team.key}
              team={team}
              expanded={expanded.has(team.key)}
              onToggle={() => onToggle(team.key)}
              selectedMemberId={selectedMemberId}
              onMemberSelect={onMemberSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TeamGroupItem({
  team,
  expanded,
  onToggle,
  selectedMemberId,
  onMemberSelect,
}: {
  team: TeamGroup;
  expanded: boolean;
  onToggle: () => void;
  selectedMemberId?: number | null;
  onMemberSelect?: (memberId: number) => void;
}) {
  return (
    <div>
      <HierarchyButton
        label={team.label}
        count={team.members.length}
        expanded={expanded}
        onClick={onToggle}
        className="text-[10px]"
      />
      {expanded && (
        <div className="mt-0.5 pl-4">
          <MemberList
            members={team.members}
            selectedMemberId={selectedMemberId}
            onMemberSelect={onMemberSelect}
          />
        </div>
      )}
    </div>
  );
}

function HierarchyButton({
  label,
  count,
  expanded,
  onClick,
  className = '',
}: {
  label: string;
  count: number;
  expanded: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={expanded}
      className={`flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left font-semibold text-[#5F5E5A] transition hover:bg-[#FAFAFA] ${className}`}
    >
      <span
        className={`inline-block text-[9px] text-[#888780] transition-transform ${
          expanded ? 'rotate-90' : ''
        }`}
        aria-hidden
      >
        ▶
      </span>
      <span className="flex-1 truncate">{label}</span>
      <span className="shrink-0 text-[10px] font-medium text-[#B4B2A9]">{count}</span>
    </button>
  );
}

function MemberList({
  members,
  selectedMemberId,
  onMemberSelect,
}: {
  members: UserBrief[];
  selectedMemberId?: number | null;
  onMemberSelect?: (memberId: number) => void;
}) {
  return (
    <ul className="space-y-0.5">
      {members.map((user) => (
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
                <span className="ml-auto shrink-0 text-[10px] text-[#B4B2A9]">{user.position}</span>
              )}
            </button>
          ) : (
            <div className={itemClass(false)}>
              <span className={`h-[7px] w-[7px] shrink-0 rounded-full ${colorForId(user.id)}`} />
              <span className="truncate">{user.name}</span>
              {user.position && (
                <span className="ml-auto shrink-0 text-[10px] text-[#B4B2A9]">{user.position}</span>
              )}
            </div>
          )}
        </li>
      ))}
    </ul>
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
