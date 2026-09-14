import type { Project, SubProject } from '../../lib/api';

export const VEHICLE_SUGGESTION_KEYS = [
  'controller_name',
  'vehicle_type',
  'controller_country',
  'controller_version',
] as const;

export type VehicleSuggestionKey = (typeof VEHICLE_SUGGESTION_KEYS)[number];
export type VehicleSuggestions = Record<VehicleSuggestionKey, string[]>;

export function isVehicleSuggestionKey(key: string): key is VehicleSuggestionKey {
  return (VEHICLE_SUGGESTION_KEYS as readonly string[]).includes(key);
}

export function emptyVehicleSuggestions(): VehicleSuggestions {
  return {
    controller_name: [],
    vehicle_type: [],
    controller_country: [],
    controller_version: [],
  };
}

/** 프로젝트 차종 세트와 기존 하위 프로젝트에서 입력된 값을 모아 자동완성 후보를 만든다. */
export function collectVehicleSuggestions(
  projects: Project[],
  subprojects: SubProject[] = [],
  extra?: Partial<VehicleSuggestions>,
): VehicleSuggestions {
  const buckets: Record<VehicleSuggestionKey, Set<string>> = {
    controller_name: new Set(),
    vehicle_type: new Set(),
    controller_country: new Set(),
    controller_version: new Set(),
  };

  const add = (key: VehicleSuggestionKey, value: string | null | undefined) => {
    const trimmed = value?.trim();
    if (trimmed) buckets[key].add(trimmed);
  };

  for (const project of projects) {
    for (const set of project.vehicle_sets ?? []) {
      for (const key of VEHICLE_SUGGESTION_KEYS) add(key, set[key]);
    }
  }
  for (const subproject of subprojects) {
    for (const key of VEHICLE_SUGGESTION_KEYS) add(key, subproject[key]);
  }
  if (extra) {
    for (const key of VEHICLE_SUGGESTION_KEYS) {
      for (const value of extra[key] ?? []) add(key, value);
    }
  }

  const result = emptyVehicleSuggestions();
  for (const key of VEHICLE_SUGGESTION_KEYS) {
    result[key] = Array.from(buckets[key]).sort((a, b) => a.localeCompare(b, 'ko'));
  }
  return result;
}
