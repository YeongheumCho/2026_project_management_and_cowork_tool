'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  expandedKeysForMember,
  groupUsersByTeam,
  type CenterGroup,
  type OfficeGroup,
  type TeamGroup,
} from '../../components/AppShell/groupUsersByTeam';
import type { UserProfileUpdatePayload, UserResponse } from '../lib/adminApi';
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
  onProfileSave: (member: UserResponse, payload: UserProfileUpdatePayload) => Promise<boolean>;
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
  onProfileSave,
}: Props) {
  const groups = useMemo(() => groupUsersByTeam(users), [users]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  // 소속을 바꾸면 다른 노드로 이동하므로, 저장 직후 새 위치를 펼쳐 행이 사라진 것처럼 보이지 않게 한다.
  const [revealMemberId, setRevealMemberId] = useState<number | null>(null);

  useEffect(() => {
    if (revealMemberId === null) return;
    const keys = expandedKeysForMember(groups, revealMemberId);
    if (keys.length > 0) {
      setExpanded((prev) => {
        const next = new Set(prev);
        for (const key of keys) next.add(key);
        return next;
      });
    }
    setRevealMemberId(null);
  }, [groups, revealMemberId]);

  const toggle = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleProfileSave = async (member: UserResponse, payload: UserProfileUpdatePayload) => {
    const ok = await onProfileSave(member, payload);
    if (ok) setRevealMemberId(member.id);
    return ok;
  };

  if (users.length === 0) {
    return (
      <p className="py-8 text-center text-small text-text-subtle">
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
          onProfileSave={handleProfileSave}
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
  onProfileSave: (member: UserResponse, payload: UserProfileUpdatePayload) => Promise<boolean>;
};

function CenterNode({ center, expanded, onToggle, canEdit, savingId, deletingId, onRoleChange, onRoleSave, onDelete, onOpenHistory, onPasswordReset, onProfileSave }:CenterNodeProps) {
  const isOpen = expanded.has(center.key);
  const totalMembers =
    center.members.length +
    center.offices.reduce(
      (sum, office) =>
        sum + office.members.length + office.teams.reduce((acc, team) => acc + team.members.length, 0),
      0,
    );

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-white">
      <button
        type="button"
        onClick={() => onToggle(center.key)}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-surface-muted"
      >
        <span className="flex items-center gap-2">
          <span className="text-small text-text-subtle">{isOpen ? '▾' : '▸'}</span>
          <span className="text-md font-bold text-text">{center.label}</span>
          <span className="text-micro text-text-subtle">총 {totalMembers}명</span>
        </span>
      </button>
      {isOpen && (
        <div className="space-y-2 border-t border-surface-subtle bg-surface-muted px-3 py-3">
          {center.members.length > 0 && (
            <MembersBlock members={center.members} canEdit={canEdit} savingId={savingId} deletingId={deletingId} onRoleChange={onRoleChange} onRoleSave={onRoleSave} onDelete={onDelete} onOpenHistory={onOpenHistory} onPasswordReset={onPasswordReset} onProfileSave={onProfileSave} />
          )}
          {center.offices.map((office) => (
            <OfficeNode key={office.key} office={office} expanded={expanded} onToggle={onToggle} canEdit={canEdit} savingId={savingId} deletingId={deletingId} onRoleChange={onRoleChange} onRoleSave={onRoleSave} onDelete={onDelete} onOpenHistory={onOpenHistory} onPasswordReset={onPasswordReset} onProfileSave={onProfileSave} />
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
  onProfileSave: (member: UserResponse, payload: UserProfileUpdatePayload) => Promise<boolean>;
};

function OfficeNode({ office, expanded, onToggle, canEdit, savingId, deletingId, onRoleChange, onRoleSave, onDelete, onOpenHistory, onPasswordReset, onProfileSave }:OfficeNodeProps) {
  const isOpen = expanded.has(office.key);
  const totalMembers = office.members.length + office.teams.reduce((acc, team) => acc + team.members.length, 0);

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-white">
      <button
        type="button"
        onClick={() => onToggle(office.key)}
        className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-surface-muted"
      >
        <span className="flex items-center gap-2">
          <span className="text-micro text-text-subtle">{isOpen ? '▾' : '▸'}</span>
          <span className="text-body font-semibold text-text">{office.label}</span>
          <span className="text-micro text-text-subtle">총 {totalMembers}명</span>
        </span>
      </button>
      {isOpen && (
        <div className="space-y-2 border-t border-surface-subtle px-3 py-2">
          {office.members.length > 0 && (
            <MembersBlock members={office.members} canEdit={canEdit} savingId={savingId} deletingId={deletingId} onRoleChange={onRoleChange} onRoleSave={onRoleSave} onDelete={onDelete} onOpenHistory={onOpenHistory} onPasswordReset={onPasswordReset} onProfileSave={onProfileSave} />
          )}
          {office.teams.map((team) => (
            <TeamNode key={team.key} team={team} expanded={expanded} onToggle={onToggle} canEdit={canEdit} savingId={savingId} deletingId={deletingId} onRoleChange={onRoleChange} onRoleSave={onRoleSave} onDelete={onDelete} onOpenHistory={onOpenHistory} onPasswordReset={onPasswordReset} onProfileSave={onProfileSave} />
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
  onProfileSave: (member: UserResponse, payload: UserProfileUpdatePayload) => Promise<boolean>;
};

function TeamNode({ team, expanded, onToggle, canEdit, savingId, deletingId, onRoleChange, onRoleSave, onDelete, onOpenHistory, onPasswordReset, onProfileSave }:TeamNodeProps) {
  const isOpen = expanded.has(team.key);

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface-muted">
      <button
        type="button"
        onClick={() => onToggle(team.key)}
        className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-white"
      >
        <span className="flex items-center gap-2">
          <span className="text-micro text-text-subtle">{isOpen ? '▾' : '▸'}</span>
          <span className="text-small font-semibold text-text">{team.label}</span>
          <span className="text-micro text-text-subtle">총 {team.members.length}명</span>
        </span>
      </button>
      {isOpen && (
        <div className="border-t border-surface-subtle bg-white px-2 py-2">
          <MembersBlock members={team.members} canEdit={canEdit} savingId={savingId} deletingId={deletingId} onRoleChange={onRoleChange} onRoleSave={onRoleSave} onDelete={onDelete} onOpenHistory={onOpenHistory} onPasswordReset={onPasswordReset} onProfileSave={onProfileSave} />
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
  onProfileSave: (member: UserResponse, payload: UserProfileUpdatePayload) => Promise<boolean>;
};

function MembersBlock({ members, canEdit, savingId, deletingId, onRoleChange, onRoleSave, onDelete, onOpenHistory, onPasswordReset, onProfileSave }:MembersBlockProps) {
  return (
    // overflow-x-auto 는 overflow-y 도 auto 로 강제해 소속 수정 콤보박스 목록이 잘리므로 visible 로 둔다.
    <div className="overflow-visible">
      <table className="w-full text-left text-small">
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
              onPasswordReset={onPasswordReset} onProfileSave={onProfileSave}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
