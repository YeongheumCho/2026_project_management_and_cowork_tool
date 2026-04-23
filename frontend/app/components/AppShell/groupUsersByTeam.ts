import type { UserBrief } from '../../lib/api';

export type TeamGroup = {
  /** 그룹 식별용 key — 팀 이름이거나 null(소속 미지정) */
  key: string;
  /** 화면에 표시할 팀명 */
  label: string;
  members: UserBrief[];
};

const UNASSIGNED_KEY = '__unassigned__';
const UNASSIGNED_LABEL = '소속 미지정';

/**
 * users 를 team 필드 기준으로 그룹핑한다.
 *
 * - 팀이 없는(null/빈문자) 사용자는 "소속 미지정" 그룹으로 모임
 * - 각 그룹 내부는 이름 가나다 순
 * - 그룹 순서: 이름(locale) 오름차순, 단 "소속 미지정" 은 항상 마지막
 */
export function groupUsersByTeam(users: UserBrief[]): TeamGroup[] {
  const buckets = new Map<string, { label: string; members: UserBrief[] }>();

  for (const user of users) {
    const teamRaw = (user.team ?? '').trim();
    const key = teamRaw || UNASSIGNED_KEY;
    const label = teamRaw || UNASSIGNED_LABEL;
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.members.push(user);
    } else {
      buckets.set(key, { label, members: [user] });
    }
  }

  const groups: TeamGroup[] = Array.from(buckets.entries()).map(
    ([key, { label, members }]) => ({
      key,
      label,
      members: [...members].sort((left, right) =>
        left.name.localeCompare(right.name, 'ko'),
      ),
    }),
  );

  groups.sort((left, right) => {
    if (left.key === UNASSIGNED_KEY) return 1;
    if (right.key === UNASSIGNED_KEY) return -1;
    return left.label.localeCompare(right.label, 'ko');
  });

  return groups;
}

/**
 * 기본 펼쳐질 그룹 key 집합을 계산한다.
 * - 내 팀이 있으면 내 팀 key 하나만
 * - 내 팀을 못 찾으면(데이터 누락 등) 첫 번째 그룹을 펼침
 * - 그룹이 하나뿐이면 그 그룹 펼침
 */
export function initialExpandedKeys(
  groups: TeamGroup[],
  myTeam: string | null | undefined,
): Set<string> {
  if (groups.length === 0) return new Set();
  if (groups.length === 1) return new Set([groups[0].key]);

  const myTeamTrim = (myTeam ?? '').trim();
  if (myTeamTrim) {
    const hit = groups.find((group) => group.key === myTeamTrim);
    if (hit) return new Set([hit.key]);
  }
  return new Set([groups[0].key]);
}
