'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  apiFetch,
  type ProjectHistorySummary,
  type Project,
  type ProjectTimeSummary,
  type SubProject,
  type UserBrief,
} from '../../lib/api';

type UseProjectsResult = {
  projects: Project[];
  subprojects: SubProject[];
  users: UserBrief[];
  timeByProject: Map<number, ProjectTimeSummary>;
  historyByProject: Map<number, ProjectHistorySummary>;
  byProject: Map<number, SubProject[]>;
  loading: boolean;
  error: string;
  reload: () => Promise<void>;
  setError: (msg: string) => void;
};

export function useProjects(enabled: boolean): UseProjectsResult {
  const [projects, setProjects] = useState<Project[]>([]);
  const [subprojects, setSubProjects] = useState<SubProject[]>([]);
  const [users, setUsers] = useState<UserBrief[]>([]);
  const [timeSummary, setTimeSummary] = useState<ProjectTimeSummary[]>([]);
  const [historySummary, setHistorySummary] = useState<ProjectHistorySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [projectList, subprojectList, userList, timeSummaryList, historySummaryList] =
        await Promise.all([
          apiFetch<Project[]>('/projects'),
          apiFetch<SubProject[]>('/subprojects'),
          apiFetch<UserBrief[]>('/users'),
          apiFetch<ProjectTimeSummary[]>('/projects/time-summary'),
          apiFetch<ProjectHistorySummary[]>('/projects/history-summary'),
        ]);
      setProjects(projectList);
      setSubProjects(subprojectList);
      setUsers(userList);
      setTimeSummary(timeSummaryList);
      setHistorySummary(historySummaryList);
      setError('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (enabled) void reload();
  }, [enabled, reload]);

  const byProject = useMemo(() => {
    const map = new Map<number, SubProject[]>();
    for (const subproject of subprojects) {
      const items = map.get(subproject.project_id) ?? [];
      items.push(subproject);
      map.set(subproject.project_id, items);
    }
    for (const items of map.values()) {
      items.sort((left, right) => left.start_date.localeCompare(right.start_date));
    }
    return map;
  }, [subprojects]);

  const timeByProject = useMemo(() => {
    const map = new Map<number, ProjectTimeSummary>();
    for (const summary of timeSummary) {
      map.set(summary.project_id, summary);
    }
    return map;
  }, [timeSummary]);

  const historyByProject = useMemo(() => {
    const map = new Map<number, ProjectHistorySummary>();
    for (const summary of historySummary) {
      map.set(summary.project_id, summary);
    }
    return map;
  }, [historySummary]);

  return {
    projects,
    subprojects,
    users,
    timeByProject,
    historyByProject,
    byProject,
    loading,
    error,
    reload,
    setError,
  };
}
