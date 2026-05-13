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
import { compactPosition } from '../lib/display';

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

  const toggleMembers = (memberIds: number[]) => {
    if (disabled || singleSelection) return;
    const selected = new Set(selectedIds);
    const allSelected = memberIds.every((memberId) => selected.has(memberId));
    for (const memberId of memberIds) {
      if (allSelected) selected.delete(memberId);
      else selected.add(memberId);
    }
    onChange(Array.from(selected));
  };

  const selectAll = () => {
    if (disabled || singleSelection) return;
    onChange(users.map((user) => user.id));
  };

  const clearAll = () => {
    if (disabled || singleSelection) return;
    onChange([]);
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
      {!singleSelection && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={selectAll}
            disabled={disabled || selectedIds.length === users.length}
            className="rounded-full border border-[#D8D3FF] bg-[#F5F3FF] px-3 py-1 text-micro font-bold text-[#534AB7] disabled:cursor-not-allowed disabled:opacity-50"
          >
            전체 선택
          </button>
          <button
            type="button"
            onClick={clearAll}
            disabled={disabled || selectedIds.length === 0}
            className="rounded-full border border-[#EAEAE4] bg-white px-3 py-1 text-micro font-bold text-[#66645C] disabled:cursor-not-allowed disabled:opacity-50"
          >
            전체 해제
          </button>
          <span className="text-micro text-[#888780]">
            {selectedIds.length}/{users.length}명 선택
          </span>
        </div>
      )}
      {groups.map((center) => (
        <CenterPickerGroup
          key={center.key}
          center={center}
          expanded={expanded}
          selectedIds={selectedIds}
          onToggle={toggleGroup}
          onToggleMember={toggleMember}
          onToggleMembers={toggleMembers}
          singleSelection={singleSelection}
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
  onToggleMembers,
  singleSelection,
  disabled,
}: {
  center: CenterGroup<UserBrief>;
  expanded: Set<string>;
  selectedIds: number[];
  onToggle: (key: string) => void;
  onToggleMember: (memberId: number) => void;
  onToggleMembers: (memberIds: number[]) => void;
  singleSelection: boolean;
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
      <div className="flex flex-wrap items-center gap-1.5">
        <GroupButton
          label={center.label}
          count={count}
          isOpen={isOpen}
          isActive={centerContainsSelected(center, selectedIds)}
          onClick={() => onToggle(center.key)}
          disabled={disabled}
        />
        {!singleSelection && (
          <GroupSelectButton
            label="조직 선택"
            memberIds={[
              ...center.members.map((member) => member.id),
              ...center.offices.flatMap((office) => [
                ...office.members.map((member) => member.id),
                ...office.teams.flatMap((team) => team.members.map((member) => member.id)),
              ]),
            ]}
            selectedIds={selectedIds}
            onToggleMembers={onToggleMembers}
            disabled={disabled}
          />
        )}
      </div>

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
              onToggleMembers={onToggleMembers}
              singleSelection={singleSelection}
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
  onToggleMembers,
  singleSelection,
  disabled,
}: {
  office: OfficeGroup<UserBrief>;
  expanded: Set<string>;
  selectedIds: number[];
  onToggle: (key: string) => void;
  onToggleMember: (memberId: number) => void;
  onToggleMembers: (memberIds: number[]) => void;
  singleSelection: boolean;
  disabled: boolean;
}) {
  const isOpen = expanded.has(office.key);
  const count =
    office.members.length +
    office.teams.reduce((sum, team) => sum + team.members.length, 0);

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-1.5">
        <GroupButton
          label={office.label}
          count={count}
          isOpen={isOpen}
          isActive={officeContainsSelected(office, selectedIds)}
          onClick={() => onToggle(office.key)}
          disabled={disabled}
        />
        {!singleSelection && (
          <GroupSelectButton
            label="실 선택"
            memberIds={[
              ...office.members.map((member) => member.id),
              ...office.teams.flatMap((team) => team.members.map((member) => member.id)),
            ]}
            selectedIds={selectedIds}
            onToggleMembers={onToggleMembers}
            disabled={disabled}
          />
        )}
      </div>

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
              onToggleMembers={onToggleMembers}
              singleSelection={singleSelection}
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
  onToggleMembers,
  singleSelection,
  disabled,
}: {
  team: TeamGroup<UserBrief>;
  expanded: boolean;
  selectedIds: number[];
  onToggle: () => void;
  onToggleMember: (memberId: number) => void;
  onToggleMembers: (memberIds: number[]) => void;
  singleSelection: boolean;
  disabled: boolean;
}) {
  const teamMemberIds = team.members.map((member) => member.id);
  const allSelected =
    teamMemberIds.length > 0 &&
    teamMemberIds.every((memberId) => selectedIds.includes(memberId));
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-1.5">
        <GroupButton
          label={team.label}
          count={team.members.length}
          isOpen={expanded}
          isActive={team.members.some((member) => selectedIds.includes(member.id))}
          onClick={onToggle}
          disabled={disabled}
        />
        {!singleSelection && (
          <button
            type="button"
            onClick={() => onToggleMembers(teamMemberIds)}
            disabled={disabled || teamMemberIds.length === 0}
            className="rounded-full border border-[#D8D3FF] px-[9px] py-1 text-micro font-bold text-[#534AB7] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {allSelected ? '팀 해제' : '팀 선택'}
          </button>
        )}
      </div>

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

function GroupSelectButton({
  label,
  memberIds,
  selectedIds,
  onToggleMembers,
  disabled,
}: {
  label: string;
  memberIds: number[];
  selectedIds: number[];
  onToggleMembers: (memberIds: number[]) => void;
  disabled: boolean;
}) {
  const uniqueIds = Array.from(new Set(memberIds));
  const allSelected =
    uniqueIds.length > 0 &&
    uniqueIds.every((memberId) => selectedIds.includes(memberId));

  return (
    <button
      type="button"
      onClick={() => onToggleMembers(uniqueIds)}
      disabled={disabled || uniqueIds.length === 0}
      className="rounded-full border border-[#D8D3FF] px-[9px] py-1 text-micro font-bold text-[#534AB7] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {allSelected ? `${label} 해제` : label}
    </button>
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
      className={`inline-flex items-center gap-1.5 rounded-full border px-[9px] py-1 text-micro ${
        isActive
          ? 'border-[#534AB7] bg-[#EEEDFE] text-[#534AB7]'
          : 'border-[#EAEAE4] text-[#888780] hover:bg-[#FAFAFA]'
      } disabled:cursor-not-allowed disabled:opacity-60`}
    >
      <span
        className={`inline-block text-nano transition-transform ${
          isOpen ? 'rotate-90' : ''
        }`}
        aria-hidden
      >
        ▸
      </span>
      <span>{label}</span>
      <span className="text-tiny opacity-70">{count}</span>
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
            className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-[9px] py-1 text-micro ${
              active
                ? `${softColorForPosition(user.position)} ${textColorForPosition(user.position)} border-transparent`
                : 'border-[#EAEAE4] text-[#888780] hover:bg-[#FAFAFA]'
            } disabled:cursor-not-allowed disabled:opacity-60`}
          >
            <span className={`h-[6px] w-[6px] rounded-full ${colorForPosition(user.position)}`} />
            {user.name}
            {compactPosition(user.position) ? ` · ${compactPosition(user.position)}` : ''}
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
