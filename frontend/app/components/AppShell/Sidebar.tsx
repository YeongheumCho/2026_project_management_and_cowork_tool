'use client';

import Link from 'next/link';
import type { Project, UserBrief } from '../../lib/api';
import { colorForId } from './colors';

type Props = {
  projects: Project[];
  users: UserBrief[];
};

/**
 * 좌측 사이드바 — "프로젝트" 섹션 + "팀원" 섹션.
 * 각 항목은 색상 도트 + 이름으로 구성되며, 프로젝트는 상세 페이지 링크.
 */
export default function Sidebar({ projects, users }: Props) {
  return (
    <aside className="hidden w-56 shrink-0 border-r border-slate-200 bg-white lg:block">
      <div className="h-full overflow-y-auto px-4 py-6">
        <Section title="프로젝트">
          {projects.length === 0 ? (
            <EmptyHint text="아직 프로젝트가 없습니다." />
          ) : (
            <ul className="space-y-1">
              {projects.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/projects/${p.id}`}
                    className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${colorForId(p.id)}`}
                    />
                    <span className="truncate">{p.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="팀원" className="mt-6">
          {users.length === 0 ? (
            <EmptyHint text="등록된 팀원이 없습니다." />
          ) : (
            <ul className="space-y-1">
              {users.map((u) => (
                <li
                  key={u.id}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-700"
                >
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${colorForId(u.id)}`}
                  />
                  <span className="truncate">{u.name}</span>
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
      <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
        {title}
      </p>
      {children}
    </div>
  );
}

function EmptyHint({ text }: { text: string }) {
  return <p className="px-2 text-xs text-slate-400">{text}</p>;
}
