/**
 * AppShell 상단 탭 네비게이션 정의.
 * 라우트 추가/라벨 변경 시 여기 한 곳만 수정한다.
 *
 * Figma WorkFlow AI 레이아웃에 맞춰 핵심 4개 탭을 상단으로 승격.
 * (프로젝트 목록/할 일/조직도 등은 이후 단계에서 정리)
 */
export type NavItem = {
  href: string;
  label: string;
};

export const TOP_NAV: NavItem[] = [
  { href: '/dashboard', label: '개요' },
  { href: '/team-calendar', label: '팀 캘린더' },
  { href: '/personal-calendar', label: '개인 캘린더' },
  { href: '/projects', label: '프로젝트' },
];
