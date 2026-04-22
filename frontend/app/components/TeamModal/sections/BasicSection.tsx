'use client';

import { PROJECT_TYPE_LABEL, type Project, type UserBrief } from '../../../lib/api';
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

/**
 * 모든 소프로젝트가 공통으로 갖는 기본 필드:
 * 프로젝트 · 이름 · 담당자 · 시작/종료일.
 */
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
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({PROJECT_TYPE_LABEL[p.project_type] ?? '일반'})
              </option>
            ))}
          </select>
        </Field>
        <Field label={isEtc ? '업무 제목' : '소프로젝트 / 기능명'}>
          <input
            value={f.name}
            onChange={(e) => set('name', e.target.value)}
            disabled={!isAdmin}
            className="input"
            placeholder={isEtc ? '예: 4월 휴가' : '예: 로그인 기능 개발'}
          />
        </Field>
        <Field label="담당자">
          <select
            value={f.assigneeId}
            onChange={(e) => set('assigneeId', Number(e.target.value))}
            disabled={!isAdmin}
            className="input"
          >
            <option value="">팀원 선택</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.role === 'admin' ? '관리자' : '일반'})
              </option>
            ))}
          </select>
        </Field>
        <Field label="시작일 ~ 종료일">
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
