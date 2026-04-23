export type OrgMember = {
  id: number;
  name: string;
  position?: string | null;
  center?: string | null;
  office?: string | null;
  team?: string | null;
};

export type TeamGroup<U extends OrgMember = OrgMember> = {
  key: string;
  label: string;
  members: U[];
};

export type OfficeGroup<U extends OrgMember = OrgMember> = {
  key: string;
  label: string;
  members: U[];
  teams: TeamGroup<U>[];
};

export type CenterGroup<U extends OrgMember = OrgMember> = {
  key: string;
  label: string;
  members: U[];
  offices: OfficeGroup<U>[];
};

const UNASSIGNED_CENTER_KEY = '__unassigned_center__';
const UNASSIGNED_CENTER_LABEL = '미분류 조직';
const POSITION_PRIORITY = ['이사', '수석', '책임', '선임', '전임', '인턴'] as const;

function positionRank(position: string | null | undefined) {
  const normalized = (position ?? '').trim();
  const index = POSITION_PRIORITY.findIndex((keyword) => normalized.includes(keyword));
  return index === -1 ? POSITION_PRIORITY.length : index;
}

function sortUsers<U extends OrgMember>(users: U[]): U[] {
  return [...users].sort((left, right) => {
    const rankDiff = positionRank(left.position) - positionRank(right.position);
    if (rankDiff !== 0) return rankDiff;

    const positionDiff = (left.position ?? '').localeCompare(right.position ?? '', 'ko');
    if (positionDiff !== 0) return positionDiff;

    return left.name.localeCompare(right.name, 'ko');
  });
}

function sortByLabel<T extends { label: string }>(items: T[]) {
  return items.sort((left, right) => left.label.localeCompare(right.label, 'ko'));
}

function normalizedLeaf(user: OrgMember) {
  return (user.team ?? user.office ?? user.center ?? '').trim();
}

export function groupUsersByTeam<U extends OrgMember>(users: U[]): CenterGroup<U>[] {
  const centers = new Map<
    string,
    {
      label: string;
      members: U[];
      offices: Map<
        string,
        {
          label: string;
          members: U[];
          teams: Map<string, TeamGroup<U>>;
        }
      >;
    }
  >();

  for (const user of users) {
    const centerLabel = (user.center ?? '').trim() || UNASSIGNED_CENTER_LABEL;
    const centerKey = (user.center ?? '').trim() || UNASSIGNED_CENTER_KEY;

    let center = centers.get(centerKey);
    if (!center) {
      center = { label: centerLabel, members: [], offices: new Map() };
      centers.set(centerKey, center);
    }

    const officeLabel = (user.office ?? '').trim();
    const teamLabel = (user.team ?? '').trim();

    if (!officeLabel) {
      center.members.push(user);
      continue;
    }

    const officeKey = `${centerKey}::${officeLabel}`;
    let office = center.offices.get(officeKey);
    if (!office) {
      office = { label: officeLabel, members: [], teams: new Map() };
      center.offices.set(officeKey, office);
    }

    if (!teamLabel) {
      office.members.push(user);
      continue;
    }

    const teamKey = `${officeKey}::${teamLabel}`;
    const existingTeam = office.teams.get(teamKey);
    if (existingTeam) {
      existingTeam.members.push(user);
    } else {
      office.teams.set(teamKey, {
        key: teamKey,
        label: teamLabel,
        members: [user],
      });
    }
  }

  const groups = Array.from(centers.entries()).map(([key, center]) => ({
    key,
    label: center.label,
    members: sortUsers(center.members),
    offices: sortByLabel(
      Array.from(center.offices.entries()).map(([officeKey, office]) => ({
        key: officeKey,
        label: office.label,
        members: sortUsers(office.members),
        teams: sortByLabel(
          Array.from(office.teams.values()).map((team) => ({
            ...team,
            members: sortUsers(team.members),
          })),
        ),
      })),
    ),
  }));

  groups.sort((left, right) => {
    if (left.key === UNASSIGNED_CENTER_KEY) return 1;
    if (right.key === UNASSIGNED_CENTER_KEY) return -1;
    return left.label.localeCompare(right.label, 'ko');
  });

  return groups;
}

export function initialExpandedKeys<U extends OrgMember>(
  groups: CenterGroup<U>[],
  myTeam: string | null | undefined,
): Set<string> {
  if (groups.length === 0) return new Set();

  const myLeaf = (myTeam ?? '').trim();
  if (myLeaf) {
    for (const center of groups) {
      if (
        center.label === myLeaf ||
        center.members.some((user) => normalizedLeaf(user) === myLeaf)
      ) {
        return new Set([center.key]);
      }

      for (const office of center.offices) {
        if (
          office.label === myLeaf ||
          office.members.some((user) => normalizedLeaf(user) === myLeaf)
        ) {
          return new Set([center.key, office.key]);
        }

        for (const team of office.teams) {
          if (
            team.label === myLeaf ||
            team.members.some((user) => normalizedLeaf(user) === myLeaf)
          ) {
            return new Set([center.key, office.key, team.key]);
          }
        }
      }
    }
  }

  const firstCenter = groups[0];
  const firstOffice = firstCenter.offices[0];
  const firstTeam = firstOffice?.teams[0];

  return new Set(
    [firstCenter.key, firstOffice?.key, firstTeam?.key].filter(Boolean) as string[],
  );
}

export function expandedKeysForMember<U extends OrgMember>(
  groups: CenterGroup<U>[],
  memberId: number,
): string[] {
  for (const center of groups) {
    if (center.members.some((member) => member.id === memberId)) {
      return [center.key];
    }

    for (const office of center.offices) {
      if (office.members.some((member) => member.id === memberId)) {
        return [center.key, office.key];
      }

      for (const team of office.teams) {
        if (team.members.some((member) => member.id === memberId)) {
          return [center.key, office.key, team.key];
        }
      }
    }
  }

  return [];
}

export function flattenTeamGroups<U extends OrgMember>(
  groups: CenterGroup<U>[],
): TeamGroup<U>[] {
  const flat: TeamGroup<U>[] = [];

  for (const center of groups) {
    if (center.members.length > 0) {
      flat.push({
        key: `${center.key}::direct`,
        label: center.label,
        members: center.members,
      });
    }

    for (const office of center.offices) {
      if (office.members.length > 0) {
        flat.push({
          key: `${office.key}::direct`,
          label: office.label,
          members: office.members,
        });
      }

      flat.push(...office.teams);
    }
  }

  return flat;
}
