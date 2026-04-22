'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  apiFetch,
  PROJECT_TYPE_LABEL,
  type ProjectType,
  type Template,
  type TemplateTaskItem,
} from '../../lib/api';

const EMPTY_TASKS: TemplateTaskItem[] = [
  { name: '플래닝', weight: 20 },
  { name: '분석', weight: 20 },
  { name: '구현', weight: 20 },
  { name: '검증', weight: 20 },
  { name: '정리', weight: 20 },
];

export default function TemplateManager() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [projectType, setProjectType] =
    useState<ProjectType>('regular_inspection');
  const [triggerKeyword, setTriggerKeyword] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [tasks, setTasks] = useState<TemplateTaskItem[]>(EMPTY_TASKS);

  useEffect(() => {
    void loadTemplates();
  }, []);

  const totalWeight = useMemo(
    () => tasks.reduce((sum, task) => sum + Number(task.weight || 0), 0),
    [tasks],
  );

  async function loadTemplates() {
    setLoading(true);
    try {
      const response = await apiFetch<Template[]>('/templates');
      setTemplates(response);
      setError('');
    } catch (nextError) {
      setError((nextError as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setEditingId(null);
    setName('');
    setProjectType('regular_inspection');
    setTriggerKeyword('');
    setIsDefault(false);
    setTasks(EMPTY_TASKS);
  }

  function startEdit(template: Template) {
    setEditingId(template.id);
    setName(template.name);
    setProjectType(template.project_type as ProjectType);
    setTriggerKeyword(template.trigger_keyword ?? '');
    setIsDefault(template.is_default);
    setTasks(
      template.tasks.length > 0
        ? template.tasks
        : EMPTY_TASKS,
    );
    setMessage('');
    setError('');
  }

  function updateTask(index: number, next: Partial<TemplateTaskItem>) {
    setTasks((current) =>
      current.map((task, taskIndex) =>
        taskIndex === index ? { ...task, ...next } : task,
      ),
    );
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setError('템플릿 이름을 입력해주세요.');
      return;
    }
    if (totalWeight !== 100) {
      setError('태스크 가중치 합계는 100이어야 합니다.');
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');
    try {
      const payload = {
        name: name.trim(),
        project_type: projectType,
        trigger_keyword: triggerKeyword.trim() || null,
        is_default: isDefault,
        tasks,
      };
      if (editingId) {
        await apiFetch<Template>(`/templates/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        setMessage('템플릿을 수정했습니다.');
      } else {
        await apiFetch<Template>('/templates', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setMessage('템플릿을 생성했습니다.');
      }
      await loadTemplates();
      resetForm();
    } catch (nextError) {
      setError((nextError as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(templateId: number) {
    if (!window.confirm('이 템플릿을 삭제할까요?')) return;
    try {
      await apiFetch<void>(`/templates/${templateId}`, { method: 'DELETE' });
      setMessage('템플릿을 삭제했습니다.');
      if (editingId === templateId) resetForm();
      await loadTemplates();
    } catch (nextError) {
      setError((nextError as Error).message);
    }
  }

  return (
    <section className="rounded-3xl border border-[#EAEAE4] bg-white p-6 shadow-sm">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-[#1A1A1A]">템플릿 관리</h3>
          <p className="mt-1 text-sm text-[#888780]">
            프로젝트 유형별 기본 태스크와 키워드 기반 자동 템플릿을 관리합니다.
          </p>
        </div>
        {editingId && (
          <button
            type="button"
            onClick={resetForm}
            className="rounded-lg border border-[#D3D1C7] px-3 py-2 text-xs font-bold text-[#5F5E5A]"
          >
            새 템플릿으로 전환
          </button>
        )}
      </div>

      {error && (
        <p className="mb-4 rounded-xl bg-[#FCEBEB] px-4 py-3 text-sm text-[#A32D2D]">
          {error}
        </p>
      )}
      {message && (
        <p className="mb-4 rounded-xl bg-[#EAF3DE] px-4 py-3 text-sm text-[#3B6D11]">
          {message}
        </p>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.85fr)_minmax(360px,1.15fr)]">
        <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-[#EAEAE4] bg-[#FAFAFA] p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="템플릿 이름">
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="input"
                placeholder="예: 정기 검증 기본 템플릿"
              />
            </Field>
            <Field label="프로젝트 유형">
              <select
                value={projectType}
                onChange={(event) => setProjectType(event.target.value as ProjectType)}
                className="input"
              >
                {Object.entries(PROJECT_TYPE_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="트리거 키워드">
            <input
              value={triggerKeyword}
              onChange={(event) => setTriggerKeyword(event.target.value)}
              className="input"
              placeholder="예: 정기 검증"
            />
          </Field>

          <label className="flex items-center justify-between rounded-xl border border-[#EAEAE4] bg-white px-4 py-3">
            <span className="text-sm font-semibold text-[#1A1A1A]">
              기본 템플릿으로 사용
            </span>
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(event) => setIsDefault(event.target.checked)}
              className="h-4 w-4 accent-[#534AB7]"
            />
          </label>

          <div className="rounded-xl border border-[#EAEAE4] bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-[#1A1A1A]">태스크 가중치</p>
              <span
                className={`rounded-full px-3 py-1 text-xs font-bold ${
                  totalWeight === 100
                    ? 'bg-[#EAF3DE] text-[#3B6D11]'
                    : 'bg-[#FCEBEB] text-[#A32D2D]'
                }`}
              >
                합계 {totalWeight}
              </span>
            </div>

            <div className="space-y-3">
              {tasks.map((task, index) => (
                <div key={`${task.name}-${index}`} className="grid gap-3 md:grid-cols-[minmax(0,1fr)_92px]">
                  <input
                    value={task.name}
                    onChange={(event) => updateTask(index, { name: event.target.value })}
                    className="input"
                    placeholder="태스크 이름"
                  />
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={task.weight}
                    onChange={(event) =>
                      updateTask(index, { weight: Number(event.target.value) })
                    }
                    className="input"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={resetForm}
              className="rounded-lg border border-[#D3D1C7] px-4 py-2 text-xs font-bold text-[#5F5E5A]"
            >
              초기화
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-[#534AB7] px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
            >
              {saving ? '저장 중...' : editingId ? '템플릿 수정' : '템플릿 생성'}
            </button>
          </div>
        </form>

        <div className="rounded-2xl border border-[#EAEAE4] bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <h4 className="text-base font-bold text-[#1A1A1A]">등록된 템플릿</h4>
            <span className="text-xs text-[#888780]">{templates.length}건</span>
          </div>

          <div className="space-y-3">
            {loading && (
              <p className="rounded-xl bg-[#FAFAFA] px-4 py-6 text-center text-sm text-[#888780]">
                불러오는 중...
              </p>
            )}
            {!loading && templates.length === 0 && (
              <p className="rounded-xl bg-[#FAFAFA] px-4 py-6 text-center text-sm text-[#888780]">
                아직 등록된 템플릿이 없습니다.
              </p>
            )}
            {templates.map((template) => (
              <article
                key={template.id}
                className="rounded-xl border border-[#EAEAE4] bg-[#FAFAFA] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-[#1A1A1A]">
                      {template.name}
                    </p>
                    <p className="mt-1 text-xs text-[#888780]">
                      {PROJECT_TYPE_LABEL[template.project_type] ?? template.project_type}
                      {template.trigger_keyword
                        ? ` · 키워드 ${template.trigger_keyword}`
                        : ''}
                    </p>
                  </div>
                  {template.is_default && (
                    <span className="rounded-full bg-[#EEEDFE] px-3 py-1 text-[10px] font-bold text-[#534AB7]">
                      기본
                    </span>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {template.tasks.map((task) => (
                    <span
                      key={`${template.id}-${task.name}`}
                      className="rounded-full border border-[#EAEAE4] bg-white px-3 py-1 text-[11px] text-[#5F5E5A]"
                    >
                      {task.name} {task.weight}%
                    </span>
                  ))}
                </div>

                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => startEdit(template)}
                    className="rounded-lg border border-[#D3D1C7] px-3 py-2 text-xs font-bold text-[#534AB7]"
                  >
                    수정
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(template.id)}
                    className="rounded-lg border border-[#F4C9C9] px-3 py-2 text-xs font-bold text-[#A32D2D]"
                  >
                    삭제
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-bold uppercase tracking-[0.8px] text-[#888780]">
        {label}
      </span>
      {children}
    </label>
  );
}
