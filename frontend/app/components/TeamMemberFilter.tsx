'use client';

import { useEffect, useMemo, useState } from 'react';
import type { UserBrief } from '../lib/api';
import {
  expandedKeysForMember,
  groupUsersByTeam,
  initialExpandedKeys,
  type CenterGroup,
  type OfficeGroup,
  type TeamGroup,
} from './AppShell/groupUsersByTeam';
import {
  colorForPosition,
  softColorForPosition,
  textColorForPosition,
} from './AppShell/colors';

type Props = {
  users: UserBrief[];
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  myTeam?: string | null;
  showAll?: boolean;
  allLabel?: string;
  singleSelection?: boolean;
  className?: string;
};

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

  useEffect(() => {
    setExpanded((current) => {
      if (current.size > 0) return current;
      return initialExpandedKeys(groups, myTeam);
    });
  }, [groups, myTeam]);

  useEffect(() => {
    if (selectedId == null) return;
    const keys = expandedKeysForMember(groups, selectedId);
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
    <div className={`space-y-2 ${className ?? ''}`}>
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
        {groups.map((center) => (
          <CenterFilterGroup
            key={center.key}
            center={center}
            expanded={expanded}
            onToggle={toggleGroup}
            selectedId={selectedId}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}

function CenterFilterGroup({
  center,
  expanded,
  onToggle,
  selectedId,
  onSelect,
}: {
  center: CenterGroup<UserBrief>;
  expanded: Set<string>;
  onToggle: (key: string) => void;
  selectedId: number | null;
  onSelect: (id: number | null) => void;
}) {
  const isOpen = expanded.has(center.key);
  const count =
    center.members.length +
    center.offices.reduce(
      (sum, office) =>
        sum +
        office.members.length +
        office.teams.reduce((teamSum, team) => teamSum + team.members.length, 0),
      0,
    );

  return (
    <div className="space-y-1">
      <GroupButton
        label={center.label}
        count={count}
        isOpen={isOpen}
        isActive={centerContainsSelected(center, selectedId)}
        onClick={() => onToggle(center.key)}
      />

      {isOpen && (
        <div className="space-y-1 pl-4">
          {center.members.length > 0 && (
            <MemberChips
              members={center.members}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          )}
          {center.offices.map((office) => (
            <OfficeFilterGroup
              key={office.key}
              office={office}
              expanded={expanded}
              onToggle={onToggle}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function OfficeFilterGroup({
  office,
  expanded,
  onToggle,
  selectedId,
  onSelect,
}: {
  office: OfficeGroup<UserBrief>;
  expanded: Set<string>;
  onToggle: (key: string) => void;
  selectedId: number | null;
  onSelect: (id: number | null) => void;
}) {
  const isOpen = expanded.has(office.key);
  const count =
    office.members.length +
    office.teams.reduce((sum, team) => sum + team.members.length, 0);

  return (
    <div className="space-y-1">
      <GroupButton
        label={office.label}
        count={count}
        isOpen={isOpen}
        isActive={officeContainsSelected(office, selectedId)}
        onClick={() => onToggle(office.key)}
      />

      {isOpen && (
        <div className="space-y-1 pl-4">
          {office.members.length > 0 && (
            <MemberChips
              members={office.members}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          )}
          {office.teams.map((team) => (
            <TeamFilterGroup
              key={team.key}
              team={team}
              expanded={expanded.has(team.key)}
              onToggle={() => onToggle(team.key)}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TeamFilterGroup({
  team,
  expanded,
  onToggle,
  selectedId,
  onSelect,
}: {
  team: TeamGroup<UserBrief>;
  expanded: boolean;
  onToggle: () => void;
  selectedId: number | null;
  onSelect: (id: number | null) => void;
}) {
  return (
    <div className="space-y-1">
      <GroupButton
        label={team.label}
        count={team.members.length}
        isOpen={expanded}
        isActive={team.members.some((member) => member.id === selectedId)}
        onClick={onToggle}
      />

      {expanded && (
        <div className="pl-4">
          <MemberChips
            members={team.members}
            selectedId={selectedId}
            onSelect={onSelect}
          />
        </div>
      )}
    </div>
  );
}

function GroupButton({
  label,
  count,
  isOpen,
  isActive,
  onClick,
}: {
  label: string;
  count: number;
  isOpen: boolean;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={isOpen}
      className={`inline-flex items-center gap-1.5 rounded-full border px-[9px] py-1 text-[11px] ${
        isActive
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
      <span>{label}</span>
      <span className="text-[10px] opacity-70">{count}</span>
    </button>
  );
}

function MemberChips({
  members,
  selectedId,
  onSelect,
}: {
  members: UserBrief[];
  selectedId: number | null;
  onSelect: (id: number | null) => void;
}) {
  return (
    <div className="flex flex-wrap gap-[5px]">
      {members.map((user) => {
        const active = user.id === selectedId;
        return (
          <button
            key={user.id}
            type="button"
            onClick={() => onSelect(user.id)}
            className={`inline-flex items-center gap-1 rounded-full border px-[9px] py-1 text-[11px] ${
              active
                ? `${softColorForPosition(user.position)} ${textColorForPosition(user.position)} border-transparent`
                : 'border-[#EAEAE4] text-[#888780] hover:bg-[#FAFAFA]'
            }`}
          >
            <span className={`h-[6px] w-[6px] rounded-full ${colorForPosition(user.position)}`} />
            {user.name}
          </button>
        );
      })}
    </div>
  );
}

function officeContainsSelected(office: OfficeGroup<UserBrief>, selectedId: number | null) {
  if (selectedId == null) return false;
  return (
    office.members.some((member) => member.id === selectedId) ||
    office.teams.some((team) => team.members.some((member) => member.id === selectedId))
  );
}

function centerContainsSelected(center: CenterGroup<UserBrief>, selectedId: number | null) {
  if (selectedId == null) return false;
  return (
    center.members.some((member) => member.id === selectedId) ||
    center.offices.some((office) => officeContainsSelected(office, selectedId))
  );
}
