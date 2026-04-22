'use client';

import Link from 'next/link';
import type { Project, UserBrief } from '../../lib/api';
import { colorForId } from './colors';

type Props = {
  projects: Project[];
  users: UserBrief[];
  selectedProjectId?: number | null;
  selectedMemberId?: number | null;
  onProjectSelect?: (projectId: number) => void;
  onMemberSelect?: (memberId: number) => void;
};

export default function Sidebar({
  projects,
  users,
  selectedProjectId,
  selectedMemberId,
  onProjectSelect,
  onMemberSelect,
}: Props) {
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
          {users.length === 0 ? (
            <EmptyHint text="표시할 팀원이 없습니다." />
          ) : (
            <ul className="space-y-1">
              {users.map((user) => (
                <li key={user.id}>
                  {onMemberSelect ? (
                    <button
                      type="button"
                      onClick={() => onMemberSelect(user.id)}
                      className={itemClass(selectedMemberId === user.id)}
                    >
                      <span className={`h-[7px] w-[7px] shrink-0 rounded-full ${colorForId(user.id)}`} />
                      <span className="truncate">{user.name}</span>
                    </button>
                  ) : (
                    <div className={itemClass(false)}>
                      <span className={`h-[7px] w-[7px] shrink-0 rounded-full ${colorForId(user.id)}`} />
                      <span className="truncate">{user.name}</span>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </aside>
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
