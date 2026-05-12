'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  PROJECT_TYPE_LABEL,
  type Project,
  type Template,
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
  templates: Template[];
  onApplyTemplate: (fields: Record<string, unknown>) => void;
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
  templates,
  onApplyTemplate,
}: Props) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | ''>('');
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

  // When the selected project changes, sync dates with the new parent project
  const { projectId } = f;
  useEffect(() => {
    if (!selectedProject) return;
    set('startDate', selectedProject.start_date ?? '');
    set('endDate', selectedProject.end_date ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  return (
    <section className="rounded-xl border border-slate-200 p-4">
      <h4 className="mb-3 text-sm font-semibold text-slate-700">기본 정보</h4>
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

        <Field label={isEtc ? '업무 제목' : '하위 프로젝트 / 기능명'} required>
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
          required
          helper={
            selectedProject?.participants.length
              ? '이 프로젝트에 참여 중인 인원만 선택할 수 있습니다.'
              : '프로젝트 참여 인원이 아직 없으면 전체 조직에서 선택됩니다.'
          }
        >
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
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
              max={MAX_DATE_VALUE}
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
              max={MAX_DATE_VALUE}
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
        </Field>

        {mode === 'create' && templates.length > 0 && (
          <Field
            label="입력 템플릿"
            span={2}
            helper="템플릿을 선택하면 하드코딩 필드와 자유 형식 필드 값이 함께 채워집니다."
          >
            <div className="flex gap-2">
              <select
                value={selectedTemplateId}
                onChange={(e) =>
                  setSelectedTemplateId(
                    e.target.value === '' ? '' : Number(e.target.value),
                  )
                }
                disabled={!isAdmin}
                className="input flex-1"
              >
                <option value="">템플릿 선택...</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                    {template.is_default ? ' (기본)' : ''}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={!isAdmin || selectedTemplateId === ''}
                onClick={() => {
                  const template = templates.find(
                    (item) => item.id === selectedTemplateId,
                  );
                  if (template) onApplyTemplate(template.fields);
                }}
                className="shrink-0 rounded-lg bg-[#534AB7] px-3 py-2 text-xs font-bold text-white disabled:opacity-40 hover:bg-[#433A9A]"
              >
                불러오기
              </button>
            </div>
          </Field>
        )}
      </div>
    </section>
  );
}
