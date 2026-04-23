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
import { colorForId, softColorForId, textColorForId } from './AppShell/colors';

type Props = {
  users: UserBrief[];
  selectedIds: number[];
  onChange: (nextIds: number[]) => void;
  myTeam?: string | null;
  singleSelection?: boolean;
  emptyLabel?: string;
  disabled?: boolean;
  className?: string;
};

export default function OrganizationMemberPicker({
  users,
  selectedIds,
  onChange,
  myTeam,
  singleSelection = false,
  emptyLabel = '선택 가능한 인원이 없습니다.',
  disabled = false,
  className,
}: Props) {
  const groups = useMemo(() => groupUsersByTeam(users), [users]);
  const [expanded, setExpanded] = useState<Set<string>>(() =>
    initialExpandedKeys(groups, myTeam),
  );

  useEffect(() => {
    if (groups.length === 0) return;
    setExpanded((current) => {
      if (current.size > 0) return current;
      return initialExpandedKeys(groups, myTeam);
    });
  }, [groups, myTeam]);

  useEffect(() => {
    if (selectedIds.length === 0) return;
    const keys = new Set<string>();
    for (const memberId of selectedIds) {
      for (const key of expandedKeysForMember(groups, memberId)) {
        keys.add(key);
      }
    }
    if (keys.size === 0) return;

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
  }, [groups, selectedIds]);

  const toggleGroup = (key: string) => {
    if (disabled) return;
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleMember = (memberId: number) => {
    if (disabled) return;
    if (singleSelection) {
      onChange(selectedIds[0] === memberId ? [] : [memberId]);
      return;
    }

    const selected = new Set(selectedIds);
    if (selected.has(memberId)) selected.delete(memberId);
    else selected.add(memberId);
    onChange(Array.from(selected));
  };

  if (groups.length === 0) {
    return (
      <div
        className={`rounded-xl border border-dashed border-[#D3D1C7] bg-[#FAFAFA] px-4 py-3 text-sm text-[#888780] ${className ?? ''}`}
      >
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className ?? ''}`}>
      {groups.map((center) => (
        <CenterPickerGroup
          key={center.key}
          center={center}
          expanded={expanded}
          selectedIds={selectedIds}
          onToggle={toggleGroup}
          onToggleMember={toggleMember}
          disabled={disabled}
        />
      ))}
    </div>
  );
}

function CenterPickerGroup({
  center,
  expanded,
  selectedIds,
  onToggle,
  onToggleMember,
  disabled,
}: {
  center: CenterGroup<UserBrief>;
  expanded: Set<string>;
  selectedIds: number[];
  onToggle: (key: string) => void;
  onToggleMember: (memberId: number) => void;
  disabled: boolean;
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
        isActive={centerContainsSelected(center, selectedIds)}
        onClick={() => onToggle(center.key)}
        disabled={disabled}
      />

      {isOpen && (
        <div className="space-y-1 pl-4">
          {center.members.length > 0 && (
            <MemberChips
              members={center.members}
              selectedIds={selectedIds}
              onToggleMember={onToggleMember}
              disabled={disabled}
            />
          )}
          {center.offices.map((office) => (
            <OfficePickerGroup
              key={office.key}
              office={office}
              expanded={expanded}
              selectedIds={selectedIds}
              onToggle={onToggle}
              onToggleMember={onToggleMember}
              disabled={disabled}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function OfficePickerGroup({
  office,
  expanded,
  selectedIds,
  onToggle,
  onToggleMember,
  disabled,
}: {
  office: OfficeGroup<UserBrief>;
  expanded: Set<string>;
  selectedIds: number[];
  onToggle: (key: string) => void;
  onToggleMember: (memberId: number) => void;
  disabled: boolean;
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
        isActive={officeContainsSelected(office, selectedIds)}
        onClick={() => onToggle(office.key)}
        disabled={disabled}
      />

      {isOpen && (
        <div className="space-y-1 pl-4">
          {office.members.length > 0 && (
            <MemberChips
              members={office.members}
              selectedIds={selectedIds}
              onToggleMember={onToggleMember}
              disabled={disabled}
            />
          )}
          {office.teams.map((team) => (
            <TeamPickerGroup
              key={team.key}
              team={team}
              expanded={expanded.has(team.key)}
              selectedIds={selectedIds}
              onToggle={() => onToggle(team.key)}
              onToggleMember={onToggleMember}
              disabled={disabled}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TeamPickerGroup({
  team,
  expanded,
  selectedIds,
  onToggle,
  onToggleMember,
  disabled,
}: {
  team: TeamGroup<UserBrief>;
  expanded: boolean;
  selectedIds: number[];
  onToggle: () => void;
  onToggleMember: (memberId: number) => void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-1">
      <GroupButton
        label={team.label}
        count={team.members.length}
        isOpen={expanded}
        isActive={team.members.some((member) => selectedIds.includes(member.id))}
        onClick={onToggle}
        disabled={disabled}
      />

      {expanded && (
        <div className="pl-4">
          <MemberChips
            members={team.members}
            selectedIds={selectedIds}
            onToggleMember={onToggleMember}
            disabled={disabled}
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
  disabled,
}: {
  label: string;
  count: number;
  isOpen: boolean;
  isActive: boolean;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={isOpen}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 rounded-full border px-[9px] py-1 text-[11px] ${
        isActive
          ? 'border-[#534AB7] bg-[#EEEDFE] text-[#534AB7]'
          : 'border-[#EAEAE4] text-[#888780] hover:bg-[#FAFAFA]'
      } disabled:cursor-not-allowed disabled:opacity-60`}
    >
      <span
        className={`inline-block text-[9px] transition-transform ${
          isOpen ? 'rotate-90' : ''
        }`}
        aria-hidden
      >
        ▸
      </span>
      <span>{label}</span>
      <span className="text-[10px] opacity-70">{count}</span>
    </button>
  );
}

function MemberChips({
  members,
  selectedIds,
  onToggleMember,
  disabled,
}: {
  members: UserBrief[];
  selectedIds: number[];
  onToggleMember: (memberId: number) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-[5px]">
      {members.map((user) => {
        const active = selectedIds.includes(user.id);
        return (
          <button
            key={user.id}
            type="button"
            onClick={() => onToggleMember(user.id)}
            disabled={disabled}
            className={`inline-flex items-center gap-1 rounded-full border px-[9px] py-1 text-[11px] ${
              active
                ? `${softColorForId(user.id)} ${textColorForId(user.id)} border-transparent`
                : 'border-[#EAEAE4] text-[#888780] hover:bg-[#FAFAFA]'
            } disabled:cursor-not-allowed disabled:opacity-60`}
          >
            <span className={`h-[6px] w-[6px] rounded-full ${colorForId(user.id)}`} />
            {user.name}
            {user.position ? ` · ${user.position}` : ''}
          </button>
        );
      })}
    </div>
  );
}

function officeContainsSelected(office: OfficeGroup<UserBrief>, selectedIds: number[]) {
  return (
    office.members.some((member) => selectedIds.includes(member.id)) ||
    office.teams.some((team) => team.members.some((member) => selectedIds.includes(member.id)))
  );
}

function centerContainsSelected(center: CenterGroup<UserBrief>, selectedIds: number[]) {
  return (
    center.members.some((member) => selectedIds.includes(member.id)) ||
    center.offices.some((office) => officeContainsSelected(office, selectedIds))
  );
}
