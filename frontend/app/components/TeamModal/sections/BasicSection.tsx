'use client';

import { useMemo } from 'react';
import { PROJECT_TYPE_LABEL, type Project, type UserBrief } from '../../../lib/api';
import OrganizationMemberPicker from '../../OrganizationMemberPicker';
import Field from '../../form/Field';
import type { FormSetter, FormState } from '../types';

type Props = {
  f: FormState;
  set: FormSetter;
  users: UserBrief[];
  projects: Project[];
  isAdmin: boolean;
  mode: 'create' | 'edit';
  lockedProjectId?: number;
  isEtc: boolean;
};

export default function BasicSection({
  f,
  set,
  users,
  projects,
  isAdmin,
  mode,
  lockedProjectId,
  isEtc,
}: Props) {
  const selectedProject = useMemo(
    () => projects.find((project) => project.id === f.projectId),
    [projects, f.projectId],
  );
  const availableUsers = useMemo(() => {
    if (!selectedProject || selectedProject.participants.length === 0) {
      return users;
    }
    return selectedProject.participants;
  }, [selectedProject, users]);

  return (
    <section className="rounded-xl border border-slate-200 p-4">
      <h4 className="mb-3 text-sm font-semibold text-slate-700">기본 정보</h4>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="프로젝트">
          <select
            value={f.projectId}
            onChange={(e) => set('projectId', Number(e.target.value))}
            disabled={
              !isAdmin || mode === 'edit' || lockedProjectId !== undefined
            }
            className="input"
          >
            <option value="">프로젝트 선택</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name} ({PROJECT_TYPE_LABEL[project.project_type] ?? '일반'})
              </option>
            ))}
          </select>
        </Field>

        <Field label={isEtc ? '업무 제목' : '하위 프로젝트 / 기능명'}>
          <input
            value={f.name}
            onChange={(e) => set('name', e.target.value)}
            disabled={!isAdmin}
            className="input"
            placeholder={isEtc ? '예: 4월 교육' : '예: 로그 분석 기능 개발'}
          />
        </Field>

        <Field
          label="담당자"
          span={2}
          helper={
            selectedProject?.participants.length
              ? '이 프로젝트에 참여 중인 인원만 선택할 수 있습니다.'
              : '프로젝트 참여 인원이 아직 없으면 전체 조직에서 선택됩니다.'
          }
        >
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <OrganizationMemberPicker
              users={availableUsers}
              selectedIds={f.assigneeId === '' ? [] : [f.assigneeId]}
              onChange={(nextIds) => set('assigneeId', nextIds[0] ?? '')}
              singleSelection
              disabled={!isAdmin}
            />
          </div>
        </Field>

        <Field label="시작일 ~ 종료일" span={2}>
          <div className="flex gap-2">
            <input
              type="date"
              value={f.startDate}
              onChange={(e) => set('startDate', e.target.value)}
              disabled={!isAdmin}
              className="input"
            />
            <input
              type="date"
              value={f.endDate}
              onChange={(e) => set('endDate', e.target.value)}
              disabled={!isAdmin}
              className="input"
            />
          </div>
          {f.startDate && f.endDate && f.endDate < f.startDate && (
            <p className="mt-1 text-xs text-red-500">
              종료일은 시작일 이후여야 합니다.
            </p>
          )}
        </Field>
      </div>
    </section>
  );
}
