export type NavItem = {
  href: string;
  label: string;
};

export const TOP_NAV: NavItem[] = [
  { href: '/dashboard', label: '개요' },
  { href: '/team-calendar', label: '팀 캘린더' },
  { href: '/projects', label: '프로젝트' },
  { href: '/tasks', label: 'AI 업무 배정' },
];
