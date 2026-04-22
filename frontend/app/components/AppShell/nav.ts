export type NavItem = {
  href: string;
  label: string;
};

export const TOP_NAV: NavItem[] = [
  { href: '/dashboard', label: '개요' },
  { href: '/team-calendar', label: '팀 캘린더' },
  { href: '/personal-calendar', label: '개인 캘린더' },
  { href: '/tasks', label: 'AI 업무 배정' },
];
