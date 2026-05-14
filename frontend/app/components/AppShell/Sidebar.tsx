'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { MajorProject, Project, SubProject, UserBrief } from '../../lib/api';
import { colorForPosition } from './colors';
import { compactPosition } from '../../lib/display';
import {
  expandedKeysForMember,
  groupUsersByTeam,
  initialExpandedKeys,
  type CenterGroup,
  type OfficeGroup,
  type TeamGroup,
} from './groupUsersByTeam';

type Props = {
  majorProjects: MajorProject[];
  projects: Project[];
  subprojects: SubProject[];
  users: UserBrief[];
  myTeam?: string | null;
  selectedProjectId?: number | null;
  selectedMemberId?: number | null;
  onProjectSelect?: (projectId: number) => void;
  onMemberSelect?: (memberId: number) => void;
};

export default function Sidebar({
  majorProjects,
  projects,
  subprojects,
  users,
  myTeam,
  selectedProjectId,
  selectedMemberId,
  onProjectSelect,
  onMemberSelect,
}: Props) {
  const groups = useMemo(() => groupUsersByTeam(users), [users]);
  const subprojectsByProject = useMemo(() => {
    const grouped = new Map<number, SubProject[]>();
    for (const subproject of subprojects) {
      const current = grouped.get(subproject.project_id);
      if (current) current.push(subproject);
      else grouped.set(subproject.project_id, [subproject]);
    }
    for (const rows of grouped.values()) {
      rows.sort((left, right) => left.start_date.localeCompare(right.start_date));
    }
    return grouped;
  }, [subprojects]);

  const projectTree = useMemo(() => {
    const majorById = new Map<number, MajorProject>();
    for (const majorProject of majorProjects) {
      majorById.set(majorProject.id, majorProject);
    }

    const grouped = new Map<number, { majorProject: MajorProject; projects: Project[] }>();
    for (const majorProject of majorProjects) {
      grouped.set(majorProject.id, { majorProject, projects: [] });
    }

    for (const project of projects) {
      const majorProjectId = project.major_project_id ?? project.major_project?.id;
      if (majorProjectId == null) continue;

      let majorProject = majorById.get(majorProjectId);
      if (!majorProject && project.major_project) {
        majorProject = {
          ...project.major_project,
          members: project.participants,
          project_count: 0,
          created_at: project.created_at,
        };
      }
      if (!majorProject) continue;

      const bucket = grouped.get(majorProjectId) ?? { majorProject, projects: [] };
      bucket.projects.push(project);
      grouped.set(majorProjectId, bucket);
    }

    return Array.from(grouped.values())
      .map((bucket) => ({
        ...bucket,
        projects: bucket.projects.sort((left, right) =>
          left.created_at.localeCompare(right.created_at),
        ),
      }))
      .filter((bucket) => bucket.projects.length > 0)
      .sort((left, right) => {
        if (left.majorProject.is_default !== right.majorProject.is_default) {
          return left.majorProject.is_default ? 1 : -1;
        }
        return left.majorProject.name.localeCompare(right.majorProject.name, 'ko');
      });
  }, [majorProjects, projects]);

  const subprojectsByMember = useMemo(() => {
    const grouped = new Map<number, SubProject[]>();
    for (const subproject of subprojects) {
      for (const memberId of subproject.assignee_ids) {
        const current = grouped.get(memberId);
        if (current) current.push(subproject);
        else grouped.set(memberId, [subproject]);
      }
    }
    for (const rows of grouped.values()) {
      rows.sort((left, right) => left.end_date.localeCompare(right.end_date));
    }
    return grouped;
  }, [subprojects]);
  const [expanded, setExpanded] = useState<Set<string>>(() =>
    initialExpandedKeys(groups, myTeam),
  );
  const [expandedMajorProjects, setExpandedMajorProjects] = useState<Set<number>>(new Set());
  const [expandedProjects, setExpandedProjects] = useState<Set<number>>(new Set());

  useEffect(() => {
    setExpanded((current) => {
      if (current.size > 0) return current;
      return initialExpandedKeys(groups, myTeam);
    });
  }, [groups, myTeam]);

  useEffect(() => {
    if (projectTree.length === 0) return;
    setExpandedMajorProjects((current) => {
      if (current.size > 0) return current;
      return new Set(projectTree.map((item) => item.majorProject.id));
    });
    setExpandedProjects((current) => {
      if (current.size > 0) return current;
      return new Set(projectTree.flatMap((item) => item.projects.map((project) => project.id)));
    });
  }, [projectTree]);

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

  const toggleProject = (projectId: number) => {
    setExpandedProjects((current) => {
      const next = new Set(current);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
    onProjectSelect?.(projectId);
  };

  const toggleMajorProject = (majorProjectId: number) => {
    setExpandedMajorProjects((current) => {
      const next = new Set(current);
      if (next.has(majorProjectId)) next.delete(majorProjectId);
      else next.add(majorProjectId);
      return next;
    });
  };

  return (
    <aside className="hidden w-[240px] shrink-0 border-r border-border bg-surface lg:block">
      <div className="h-full overflow-y-auto px-2.5 py-3.5">
        <Section title="프로젝트">
          {projectTree.length === 0 ? (
            <EmptyHint text="아직 프로젝트가 없습니다." />
          ) : (
            <ul className="space-y-1">
              {projectTree.map(({ majorProject, projects: childProjects }) => (
                <li key={majorProject.id}>
                  <MajorProjectItem
                    majorProject={majorProject}
                    projects={childProjects}
                    subprojectsByProject={subprojectsByProject}
                    expandedMajorProjects={expandedMajorProjects}
                    expandedProjects={expandedProjects}
                    selectedProjectId={selectedProjectId}
                    onToggleMajor={() => toggleMajorProject(majorProject.id)}
                    onToggleProject={toggleProject}
                  />
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
                  subprojectsByMember={subprojectsByMember}
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
  subprojectsByMember,
}: {
  center: CenterGroup<UserBrief>;
  expanded: Set<string>;
  onToggle: (key: string) => void;
  selectedMemberId?: number | null;
  onMemberSelect?: (memberId: number) => void;
  subprojectsByMember: Map<number, SubProject[]>;
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
              subprojectsByMember={subprojectsByMember}
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
              subprojectsByMember={subprojectsByMember}
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
  subprojectsByMember,
}: {
  office: OfficeGroup<UserBrief>;
  expanded: Set<string>;
  onToggle: (key: string) => void;
  selectedMemberId?: number | null;
  onMemberSelect?: (memberId: number) => void;
  subprojectsByMember: Map<number, SubProject[]>;
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
              subprojectsByMember={subprojectsByMember}
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
              subprojectsByMember={subprojectsByMember}
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
  subprojectsByMember,
}: {
  team: TeamGroup<UserBrief>;
  expanded: boolean;
  onToggle: () => void;
  selectedMemberId?: number | null;
  onMemberSelect?: (memberId: number) => void;
  subprojectsByMember: Map<number, SubProject[]>;
}) {
  return (
    <div>
      <HierarchyButton
        label={team.label}
        count={team.members.length}
        expanded={expanded}
        onClick={onToggle}
        className="text-tiny"
      />
      {expanded && (
        <div className="mt-0.5 pl-4">
          <MemberList
            members={team.members}
            selectedMemberId={selectedMemberId}
            onMemberSelect={onMemberSelect}
            subprojectsByMember={subprojectsByMember}
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
  active = false,
  className = '',
}: {
  label: string;
  count: number;
  expanded: boolean;
  onClick: () => void;
  active?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={expanded}
      className={`flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left font-semibold transition hover:bg-surface-muted ${
        active ? 'bg-surface-subtle text-text' : 'text-text-muted'
      } ${className}`}
    >
      <span
        className={`inline-block text-nano text-text-subtle transition-transform ${
          expanded ? 'rotate-90' : ''
        }`}
        aria-hidden
      >
        ▶
      </span>
      <span className="flex-1 truncate">{label}</span>
      <span className="shrink-0 text-tiny font-medium text-text-faint">{count}</span>
    </button>
  );
}

function MemberList({
  members,
  selectedMemberId,
  onMemberSelect,
  subprojectsByMember,
}: {
  members: UserBrief[];
  selectedMemberId?: number | null;
  onMemberSelect?: (memberId: number) => void;
  subprojectsByMember: Map<number, SubProject[]>;
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
              <span className={`h-[7px] w-[7px] shrink-0 rounded-full ${colorForPosition(user.position)}`} />
              <span className="truncate">{user.name}</span>
              {user.position && (
                <span className="ml-auto shrink-0 text-tiny text-text-faint">
                  {compactPosition(user.position)}
                </span>
              )}
            </button>
          ) : (
            <div className={itemClass(false)}>
              <span className={`h-[7px] w-[7px] shrink-0 rounded-full ${colorForPosition(user.position)}`} />
              <span className="truncate">{user.name}</span>
              {user.position && (
                <span className="ml-auto shrink-0 text-tiny text-text-faint">
                  {compactPosition(user.position)}
                </span>
              )}
            </div>
          )}
          {selectedMemberId === user.id && (
            <SidebarSubprojectList
              subprojects={subprojectsByMember.get(user.id) ?? []}
              emptyText="담당 하위 프로젝트가 없습니다."
            />
          )}
        </li>
      ))}
    </ul>
  );
}

function MajorProjectItem({
  majorProject,
  projects,
  subprojectsByProject,
  expandedMajorProjects,
  expandedProjects,
  selectedProjectId,
  onToggleMajor,
  onToggleProject,
}: {
  majorProject: MajorProject;
  projects: Project[];
  subprojectsByProject: Map<number, SubProject[]>;
  expandedMajorProjects: Set<number>;
  expandedProjects: Set<number>;
  selectedProjectId?: number | null;
  onToggleMajor: () => void;
  onToggleProject: (projectId: number) => void;
}) {
  const expanded = expandedMajorProjects.has(majorProject.id);
  const subprojectCount = projects.reduce(
    (sum, project) => sum + (subprojectsByProject.get(project.id)?.length ?? 0),
    0,
  );

  return (
    <div>
      <HierarchyButton
        label={majorProject.name}
        count={subprojectCount || projects.length}
        expanded={expanded}
        onClick={onToggleMajor}
      />
      {expanded && (
        <ul className="mt-0.5 space-y-0.5 pl-4">
          {projects.map((project) => (
            <li key={project.id}>
              <ProjectItem
                project={project}
                subprojects={subprojectsByProject.get(project.id) ?? []}
                expanded={expandedProjects.has(project.id)}
                selected={selectedProjectId === project.id}
                onToggle={() => onToggleProject(project.id)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ProjectItem({
  project,
  subprojects,
  expanded,
  selected,
  onToggle,
}: {
  project: Project;
  subprojects: SubProject[];
  expanded: boolean;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <div>
      <HierarchyButton
        label={project.name}
        count={subprojects.length}
        expanded={expanded}
        onClick={onToggle}
        active={selected}
        className="text-[10.5px]"
      />
      {expanded && (
        <SidebarSubprojectList
          subprojects={subprojects}
          emptyText="하위 프로젝트가 없습니다."
        />
      )}
    </div>
  );
}

function SidebarSubprojectList({
  subprojects,
  emptyText,
}: {
  subprojects: SubProject[];
  emptyText: string;
}) {
  if (subprojects.length === 0) {
    return <p className="ml-7 mt-0.5 text-tiny text-text-faint">{emptyText}</p>;
  }

  return (
    <ul className="ml-7 mt-0.5 max-h-[180px] space-y-0.5 overflow-y-auto pr-1">
      {subprojects.map((subproject) => (
        <li key={subproject.id}>
          <Link
            href={`/projects/${subproject.project_id}`}
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-micro font-medium text-text-muted hover:bg-surface-muted"
          >
            <span className={`h-[6px] w-[6px] shrink-0 rounded-full ${statusDotClass(subproject.status)}`} />
            <span className="truncate">{subproject.name}</span>
            <span className="ml-auto shrink-0 text-tiny text-text-faint">
              {Math.round(subproject.progress)}%
            </span>
          </Link>
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
      <p className="mb-1 px-2 text-nano font-bold uppercase tracking-[1px] text-text-subtle">
        {title}
      </p>
      {children}
    </div>
  );
}

function EmptyHint({ text }: { text: string }) {
  return <p className="px-2 text-micro text-text-faint">{text}</p>;
}

function itemClass(active: boolean) {
  return `flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-small transition ${
    active
      ? 'bg-surface-subtle font-semibold text-text'
      : 'font-medium text-text-muted hover:bg-surface-muted'
  }`;
}

function statusDotClass(status: SubProject['status']) {
  if (status === 'completed') return 'bg-verify-pass-fg';
  if (status === 'in_progress') return 'bg-verify-info-fg';
  return 'bg-text-faint';
}
