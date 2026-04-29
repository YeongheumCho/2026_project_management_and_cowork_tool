'use client';

import { useMemo, useState } from 'react';
import {
  groupUsersByTeam,
  type CenterGroup,
  type OfficeGroup,
  type TeamGroup,
} from '../../components/AppShell/groupUsersByTeam';
import type { UserResponse } from '../lib/adminApi';
import UserRoleRow from './UserRoleRow';

type Props = {
  users: UserResponse[];
  canEdit: boolean;
  savingId: string | null;
  deletingId: string | null;
  onRoleChange: (idnum: string, role: string) => void;
  onRoleSave: (member: UserResponse) => void;
  onDelete: (member: UserResponse) => void;
  onOpenHistory: (member: UserResponse) => void;
  onPasswordReset: (member: UserResponse, newPassword: string) => Promise<boolean>;
};

export default function OrgChartView({
  users,
  canEdit,
  savingId,
  deletingId,
  onRoleChange,
  onRoleSave,
  onDelete,
  onOpenHistory,
  onPasswordReset,
}: Props) {
  const groups = useMemo(() => groupUsersByTeam(users), [users]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  if (users.length === 0) {
    return (
      <p className="py-8 text-center text-[12px] text-[#888780]">
        등록된 사용자가 없습니다.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {groups.map((center) => (
        <CenterNode
          key={center.key}
          center={center}
          expanded={expanded}
          onToggle={toggle}
          canEdit={canEdit}
          savingId={savingId}
          deletingId={deletingId}
          onRoleChange={onRoleChange}
          onRoleSave={onRoleSave}
          onDelete={onDelete}
          onOpenHistory={onOpenHistory}
          onPasswordReset={onPasswordReset}
        />
      ))}
    </div>
  );
}

type CenterNodeProps = {
  center: CenterGroup<UserResponse>;
  expanded: Set<string>;
  onToggle: (key: string) => void;
  canEdit: boolean;
  savingId: string | null;
  deletingId: string | null;
  onRoleChange: (idnum: string, role: string) => void;
  onRoleSave: (member: UserResponse) => void;
  onDelete: (member: UserResponse) => void;
  onOpenHistory: (member: UserResponse) => void;
  onPasswordReset: (member: UserResponse, newPassword: string) => Promise<boolean>;
};

function CenterNode({
  center,
  expanded,
  onToggle,
  canEdit,
  savingId,
  deletingId,
  onRoleChange,
  onRoleSave,
  onDelete,
  onOpenHistory,
  onPasswordReset,
}: CenterNodeProps) {
  const isOpen = expanded.has(center.key);
  const totalMembers =
    center.members.length +
    center.offices.reduce(
      (sum, office) =>
        sum +
        office.members.length +
        office.teams.reduce((acc, team) => acc + team.members.length, 0),
      0,
    );

  return (
    <div className="overflow-hidden rounded-xl border border-[#EAEAE4] bg-white">
      <button
        type="button"
        onClick={() => onToggle(center.key)}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-[#FAFAFA]"
      >
        <span className="flex items-center gap-2">
          <span className="text-[12px] text-[#888780]">{isOpen ? '▾' : '▸'}</span>
          <span className="text-[14px] font-bold text-[#1A1A1A]">{center.label}</span>
          <span className="text-[11px] text-[#888780]">총 {totalMembers}명</span>
        </span>
      </button>

      {isOpen && (
        <div className="space-y-2 border-t border-[#F1EFE8] bg-[#FAFAFA] px-3 py-3">
          {center.members.length > 0 && (
            <MembersBlock
              members={center.members}
              canEdit={canEdit}
              savingId={savingId}
              deletingId={deletingId}
              onRoleChange={onRoleChange}
              onRoleSave={onRoleSave}
              onDelete={onDelete}
              onOpenHistory={onOpenHistory}
              onPasswordReset={onPasswordReset}
            />
          )}

          {center.offices.map((office) => (
            <OfficeNode
              key={office.key}
              office={office}
              expanded={expanded}
              onToggle={onToggle}
              canEdit={canEdit}
              savingId={savingId}
              deletingId={deletingId}
              onRoleChange={onRoleChange}
              onRoleSave={onRoleSave}
              onDelete={onDelete}
              onOpenHistory={onOpenHistory}
              onPasswordReset={onPasswordReset}
            />
          ))}
        </div>
      )}
    </div>
  );
}

type OfficeNodeProps = {
  office: OfficeGroup<UserResponse>;
  expanded: Set<string>;
  onToggle: (key: string) => void;
  canEdit: boolean;
  savingId: string | null;
  deletingId: string | null;
  onRoleChange: (idnum: string, role: string) => void;
  onRoleSave: (member: UserResponse) => void;
  onDelete: (member: UserResponse) => void;
  onOpenHistory: (member: UserResponse) => void;
  onPasswordReset: (member: UserResponse, newPassword: string) => Promise<boolean>;
};

function OfficeNode({
  office,
  expanded,
  onToggle,
  canEdit,
  savingId,
  deletingId,
  onRoleChange,
  onRoleSave,
  onDelete,
  onOpenHistory,
  onPasswordReset,
}: OfficeNodeProps) {
  const isOpen = expanded.has(office.key);
  const totalMembers =
    office.members.length +
    office.teams.reduce((acc, team) => acc + team.members.length, 0);

  return (
    <div className="overflow-hidden rounded-lg border border-[#EAEAE4] bg-white">
      <button
        type="button"
        onClick={() => onToggle(office.key)}
        className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-[#FAFAFA]"
      >
        <span className="flex items-center gap-2">
          <span className="text-[11px] text-[#888780]">{isOpen ? '▾' : '▸'}</span>
          <span className="text-[13px] font-semibold text-[#1A1A1A]">{office.label}</span>
          <span className="text-[11px] text-[#888780]">총 {totalMembers}명</span>
        </span>
      </button>

      {isOpen && (
        <div className="space-y-2 border-t border-[#F1EFE8] px-3 py-2">
          {office.members.length > 0 && (
            <MembersBlock
              members={office.members}
              canEdit={canEdit}
              savingId={savingId}
              deletingId={deletingId}
              onRoleChange={onRoleChange}
              onRoleSave={onRoleSave}
              onDelete={onDelete}
              onOpenHistory={onOpenHistory}
              onPasswordReset={onPasswordReset}
            />
          )}

          {office.teams.map((team) => (
            <TeamNode
              key={team.key}
              team={team}
              expanded={expanded}
              onToggle={onToggle}
              canEdit={canEdit}
              savingId={savingId}
              deletingId={deletingId}
              onRoleChange={onRoleChange}
              onRoleSave={onRoleSave}
              onDelete={onDelete}
              onOpenHistory={onOpenHistory}
              onPasswordReset={onPasswordReset}
            />
          ))}
        </div>
      )}
    </div>
  );
}

type TeamNodeProps = {
  team: TeamGroup<UserResponse>;
  expanded: Set<string>;
  onToggle: (key: string) => void;
  canEdit: boolean;
  savingId: string | null;
  deletingId: string | null;
  onRoleChange: (idnum: string, role: string) => void;
  onRoleSave: (member: UserResponse) => void;
  onDelete: (member: UserResponse) => void;
  onOpenHistory: (member: UserResponse) => void;
  onPasswordReset: (member: UserResponse, newPassword: string) => Promise<boolean>;
};

function TeamNode({
  team,
  expanded,
  onToggle,
  canEdit,
  savingId,
  deletingId,
  onRoleChange,
  onRoleSave,
  onDelete,
  onOpenHistory,
  onPasswordReset,
}: TeamNodeProps) {
  const isOpen = expanded.has(team.key);

  return (
    <div className="overflow-hidden rounded-lg border border-[#EAEAE4] bg-[#FAFAFA]">
      <button
        type="button"
        onClick={() => onToggle(team.key)}
        className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-white"
      >
        <span className="flex items-center gap-2">
          <span className="text-[11px] text-[#888780]">{isOpen ? '▾' : '▸'}</span>
          <span className="text-[12px] font-semibold text-[#1A1A1A]">{team.label}</span>
          <span className="text-[11px] text-[#888780]">총 {team.members.length}명</span>
        </span>
      </button>

      {isOpen && (
        <div className="border-t border-[#F1EFE8] bg-white px-2 py-2">
          <MembersBlock
            members={team.members}
            canEdit={canEdit}
            savingId={savingId}
            deletingId={deletingId}
            onRoleChange={onRoleChange}
            onRoleSave={onRoleSave}
            onDelete={onDelete}
            onOpenHistory={onOpenHistory}
            onPasswordReset={onPasswordReset}
          />
        </div>
      )}
    </div>
  );
}

type MembersBlockProps = {
  members: UserResponse[];
  canEdit: boolean;
  savingId: string | null;
  deletingId: string | null;
  onRoleChange: (idnum: string, role: string) => void;
  onRoleSave: (member: UserResponse) => void;
  onDelete: (member: UserResponse) => void;
  onOpenHistory: (member: UserResponse) => void;
  onPasswordReset: (member: UserResponse, newPassword: string) => Promise<boolean>;
};

function MembersBlock({
  members,
  canEdit,
  savingId,
  deletingId,
  onRoleChange,
  onRoleSave,
  onDelete,
  onOpenHistory,
  onPasswordReset,
}: MembersBlockProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-[12px]">
        <tbody>
          {members.map((member) => (
            <UserRoleRow
              key={member.idnum}
              member={member}
              canEdit={canEdit}
              savingId={savingId}
              deletingId={deletingId}
              onRoleChange={onRoleChange}
              onRoleSave={onRoleSave}
              onDelete={onDelete}
              onOpenHistory={onOpenHistory}
              onPasswordReset={onPasswordReset}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
