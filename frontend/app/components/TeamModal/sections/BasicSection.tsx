'use client';

import { useEffect, useMemo } from 'react';
import {
  PROJECT_TYPE_LABEL,
  type Project,
  type ProjectFieldSchema,
  type UserBrief,
} from '../../../lib/api';
import { clampDateYear, MAX_DATE_VALUE } from '../../../lib/dateInput';
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
  fieldSchema: ProjectFieldSchema;
  fieldSchemaOptions: ProjectFieldSchema[];
  selectedFieldSchemaType: string;
  onFieldSchemaTypeChange: (projectType: string) => void;
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
  fieldSchema,
  fieldSchemaOptions,
  selectedFieldSchemaType,
  onFieldSchemaTypeChange,
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
  const configuredFieldCount = fieldSchema.fields.length;

  const { projectId } = f;
  useEffect(() => {
    if (!selectedProject || mode === 'edit') return;
    set('startDate', selectedProject.start_date ?? '');
    set('endDate', selectedProject.end_date ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, projectId]);

  return (
    <section className="rounded-xl border border-border p-4">
      <h4 className="mb-3 text-sm font-semibold text-text">기본 정보</h4>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="프로젝트" required>
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

        {mode === 'edit' && (
          <Field label={isEtc ? '업무 제목' : '하위 프로젝트 / 기능명'} required>
            <input
              value={f.name}
              onChange={(e) => set('name', e.target.value)}
              disabled={!isAdmin}
              className="input"
              placeholder={isEtc ? '예: 4월 교육' : '예: 로그 분석 기능 개발'}
            />
          </Field>
        )}

        <Field
          label="담당자"
          span={2}
          required
          helper={
            selectedProject?.participants.length
              ? '이 프로젝트에 참여 중인 인원만 선택할 수 있습니다.'
              : '프로젝트 참여 인원이 아직 없으면 전체 조직에서 선택합니다.'
          }
        >
          <div className="max-h-[280px] overflow-y-auto rounded-xl border border-border bg-surface-muted p-3 pr-2">
            <OrganizationMemberPicker
              users={availableUsers}
              selectedIds={f.assigneeIds}
              onChange={(nextIds) => {
                set('assigneeIds', nextIds);
                set('assigneeId', nextIds[0] ?? '');
              }}
              disabled={!isAdmin}
            />
          </div>
        </Field>

        <Field label="시작일 ~ 종료일" span={2}>
          <div className="flex gap-2">
            <input
              type="date"
              value={f.startDate}
              min={selectedProject?.start_date ?? undefined}
              max={selectedProject?.end_date ?? MAX_DATE_VALUE}
              onInput={(e) => {
                e.currentTarget.value = clampDateYear(e.currentTarget.value);
              }}
              onChange={(e) => set('startDate', clampDateYear(e.target.value))}
              disabled={!isAdmin}
              className="input"
            />
            <input
              type="date"
              value={f.endDate}
              min={selectedProject?.start_date ?? undefined}
              max={selectedProject?.end_date ?? MAX_DATE_VALUE}
              onInput={(e) => {
                e.currentTarget.value = clampDateYear(e.currentTarget.value);
              }}
              onChange={(e) => set('endDate', clampDateYear(e.target.value))}
              disabled={!isAdmin}
              className="input"
            />
          </div>
          {f.startDate && f.endDate && f.endDate < f.startDate && (
            <p className="mt-1 text-xs text-red-500">
              종료일은 시작일 이후여야 합니다.
            </p>
          )}
          {selectedProject?.start_date &&
            f.startDate &&
            f.startDate < selectedProject.start_date && (
              <p className="mt-1 text-xs text-red-500">
                하위 프로젝트 시작일은 상위 프로젝트 시작일 이후여야 합니다.
              </p>
            )}
          {selectedProject?.end_date &&
            f.endDate &&
            f.endDate > selectedProject.end_date && (
              <p className="mt-1 text-xs text-red-500">
                하위 프로젝트 종료일은 상위 프로젝트 종료일 이내여야 합니다.
              </p>
            )}
        </Field>

        <Field
          label="템플릿"
          span={2}
          required
          helper={
            fieldSchemaOptions.length === 0
              ? '선택한 프로젝트에 할당된 템플릿이 없습니다. 관리 탭에서 템플릿을 먼저 추가해주세요.'
              : configuredFieldCount > 0
                ? '이 프로젝트에 할당된 템플릿만 선택할 수 있습니다.'
                : '선택한 템플릿에 적용할 필드가 없습니다.'
          }
        >
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
            <select
              value={selectedFieldSchemaType}
              onChange={(event) => onFieldSchemaTypeChange(event.target.value)}
              disabled={!isAdmin || fieldSchemaOptions.length === 0}
              className="input"
            >
              {fieldSchemaOptions.length === 0 && (
                <option value="">템플릿 없음</option>
              )}
              {fieldSchemaOptions.map((schema) => (
                <option key={schema.project_type} value={schema.project_type}>
                  {schema.section_label} · {schema.fields.length}개 필드
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled
              className="rounded-lg border border-border px-3 py-2 text-xs font-bold text-text-faint"
            >
              적용 중
            </button>
          </div>
        </Field>
      </div>
    </section>
  );
}
