'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  apiFetch,
  defaultFieldSchema,
  type FieldDefinition,
  type FieldOption,
  type FieldType,
  type Project,
  type ProjectFieldSchema,
} from '../../lib/api';

const FIELD_TYPE_LABEL: Record<FieldType, string> = {
  text: '텍스트',
  number: '숫자',
  date: '날짜',
  select: '선택',
  textarea: '긴 텍스트',
  checkbox: '체크박스',
};

function projectTemplatePrefix(projectId: number) {
  return `project_${projectId}_template_`;
}

function newTemplateKey(projectId: number) {
  return `${projectTemplatePrefix(projectId)}${Date.now().toString(36)}`;
}

function isTemplateForProject(schema: ProjectFieldSchema, projectId: number) {
  return String(schema.project_type).startsWith(projectTemplatePrefix(projectId));
}

function newField(order: number): FieldDefinition {
  return {
    key: '',
    label: '',
    field_type: 'text',
    options: [],
    required: false,
    order,
  };
}

function cloneFields(fields: FieldDefinition[]): FieldDefinition[] {
  return fields.map((field, order) => ({
    ...field,
    options: field.options.map((option) => ({ ...option })),
    order,
  }));
}

function uniqueTemplateName(baseName: string, templates: ProjectFieldSchema[]) {
  const names = new Set(templates.map((template) => template.section_label));
  if (!names.has(baseName)) return baseName;
  let index = 2;
  let nextName = `${baseName} 복사본`;
  while (names.has(nextName)) {
    nextName = `${baseName} 복사본 ${index}`;
    index += 1;
  }
  return nextName;
}

export default function TemplateManager() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [schemas, setSchemas] = useState<Record<string, ProjectFieldSchema>>({});
  const [activeProjectId, setActiveProjectId] = useState<number | null>(null);
  const [activeKey, setActiveKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [templateWeight, setTemplateWeight] = useState<number>(5);
  const [fields, setFields] = useState<FieldDefinition[]>([]);
  const [reuseSourceKey, setReuseSourceKey] = useState('');

  const activeProject = useMemo(
    () => projects.find((project) => project.id === activeProjectId) ?? null,
    [activeProjectId, projects],
  );
  const projectTemplates = useMemo(
    () =>
      activeProject
        ? Object.values(schemas)
            .filter((schema) => isTemplateForProject(schema, activeProject.id))
            .sort((left, right) =>
              left.section_label.localeCompare(right.section_label, 'ko-KR'),
            )
        : [],
    [activeProject, schemas],
  );
  const sortedFields = useMemo(
    () => fields.slice().sort((a, b) => a.order - b.order),
    [fields],
  );
  const reusableTemplates = useMemo(
    () =>
      Object.values(schemas)
        .filter((schema) => schema.section_label.trim())
        .sort((left, right) =>
          left.section_label.localeCompare(right.section_label, 'ko-KR'),
        ),
    [schemas],
  );

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (activeProjectId !== null) return;
    if (projects.length > 0) setActiveProjectId(projects[0].id);
  }, [activeProjectId, projects]);

  useEffect(() => {
    if (!activeProject) return;
    const templates = Object.values(schemas)
      .filter((schema) => isTemplateForProject(schema, activeProject.id))
      .sort((left, right) =>
        left.section_label.localeCompare(right.section_label, 'ko-KR'),
      );
    const nextActive = templates.some((schema) => schema.project_type === activeKey)
      ? activeKey
      : String(templates[0]?.project_type ?? '');
    setActiveKey(nextActive);
  }, [activeKey, activeProject, schemas]);

  useEffect(() => {
    const schema = activeKey ? schemas[activeKey] : null;
    setTemplateName(schema?.section_label ?? '');
    setTemplateWeight(schema?.weight ?? 5);
    setFields(schema ? cloneFields(schema.fields) : []);
    setError('');
    setMessage('');
  }, [activeKey, schemas]);

  async function load() {
    setLoading(true);
    try {
      const [projectRows, savedSchemas] = await Promise.all([
        apiFetch<Project[]>('/projects'),
        apiFetch<ProjectFieldSchema[]>('/field-schemas'),
      ]);
      setProjects(projectRows);
      setSchemas(
        Object.fromEntries(
          savedSchemas.map((schema) => [String(schema.project_type), schema]),
        ),
      );
      setError('');
    } catch (nextError) {
      setError((nextError as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function updateField<K extends keyof FieldDefinition>(
    index: number,
    key: K,
    value: FieldDefinition[K],
  ) {
    setFields((current) =>
      current.map((field, fieldIndex) =>
        fieldIndex === index ? { ...field, [key]: value } : field,
      ),
    );
  }

  function moveField(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= fields.length) return;
    setFields((current) => {
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next.map((field, order) => ({ ...field, order }));
    });
  }

  function addOption(fieldIndex: number) {
    updateField(fieldIndex, 'options', [
      ...fields[fieldIndex].options,
      { label: '', value: '' },
    ]);
  }

  function updateOption(
    fieldIndex: number,
    optionIndex: number,
    key: keyof FieldOption,
    value: string,
  ) {
    updateField(
      fieldIndex,
      'options',
      fields[fieldIndex].options.map((option, index) =>
        index === optionIndex ? { ...option, [key]: value } : option,
      ),
    );
  }

  function removeOption(fieldIndex: number, optionIndex: number) {
    updateField(
      fieldIndex,
      'options',
      fields[fieldIndex].options.filter((_, index) => index !== optionIndex),
    );
  }

  function normalizeFields() {
    return fields.map((field, order) => ({
      ...field,
      key: field.key.trim(),
      label: field.label.trim(),
      options: field.options
        .map((option) => ({
          label: option.label.trim(),
          value: option.value.trim(),
        }))
        .filter((option) => option.label && option.value),
      order,
    }));
  }

  function handleAddTemplate() {
    if (!activeProject) return;
    const key = newTemplateKey(activeProject.id);
    const base = defaultFieldSchema(String(activeProject.project_type));
    const nextSchema: ProjectFieldSchema = {
      id: 0,
      project_type: key,
      section_label: '새 템플릿',
      fields: cloneFields(base.fields),
      weight: 5,
      created_by: null,
      updated_at: new Date().toISOString(),
    };
    setSchemas((current) => ({ ...current, [key]: nextSchema }));
    setActiveKey(key);
    setMessage('새 템플릿을 추가했습니다. 이름과 필드를 설정한 뒤 저장해주세요.');
  }

  function handleReuseTemplate() {
    if (!activeProject || !reuseSourceKey) return;
    const source = schemas[reuseSourceKey];
    if (!source) return;

    const key = newTemplateKey(activeProject.id);
    const copiedName = uniqueTemplateName(source.section_label, projectTemplates);
    const nextSchema: ProjectFieldSchema = {
      id: 0,
      project_type: key,
      section_label: copiedName,
      fields: cloneFields(source.fields),
      weight: source.weight ?? 5,
      created_by: null,
      updated_at: new Date().toISOString(),
    };

    setSchemas((current) => ({ ...current, [key]: nextSchema }));
    setActiveKey(key);
    setReuseSourceKey('');
    setMessage('저장된 템플릿을 선택한 프로젝트에 복사했습니다. 필요하면 이름과 필드를 조정한 뒤 저장해주세요.');
  }

  async function handleSave() {
    if (!activeProject || !activeKey) return;
    const normalizedFields = normalizeFields();
    const keys = normalizedFields.map((field) => field.key).filter(Boolean);
    const name = templateName.trim();

    if (!name) {
      setError('템플릿 이름을 입력해주세요.');
      return;
    }
    if (templateWeight < 1 || templateWeight > 10) {
      setError('가중치는 1에서 10 사이의 값이어야 합니다.');
      return;
    }
    if (
      projectTemplates.some(
        (schema) => schema.project_type !== activeKey && schema.section_label === name,
      )
    ) {
      setError('이 프로젝트에 같은 이름의 템플릿이 이미 있습니다.');
      return;
    }
    if (keys.length !== normalizedFields.length) {
      setError('모든 필드의 고유 키를 입력해주세요.');
      return;
    }
    if (new Set(keys).size !== keys.length) {
      setError('필드 키가 중복되었습니다.');
      return;
    }
    if (normalizedFields.some((field) => !field.label)) {
      setError('모든 필드의 표시 이름을 입력해주세요.');
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');
    try {
      const updated = await apiFetch<ProjectFieldSchema>(
        `/field-schemas/${activeKey}`,
        {
          method: 'PUT',
          body: JSON.stringify({
            project_type: activeKey,
            section_label: name,
            fields: normalizedFields,
            weight: templateWeight,
          }),
        },
      );
      setSchemas((current) => ({ ...current, [activeKey]: updated }));
      setMessage('템플릿을 저장했습니다.');
    } catch (nextError) {
      setError((nextError as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!activeKey) return;
    const schema = schemas[activeKey];
    if (!schema) return;
    if (!window.confirm(`"${schema.section_label}" 템플릿을 삭제할까요?`)) return;

    try {
      await apiFetch<void>(`/field-schemas/${activeKey}`, { method: 'DELETE' });
      setSchemas((current) => {
        const next = { ...current };
        delete next[activeKey];
        return next;
      });
      setActiveKey('');
      setMessage('템플릿을 삭제했습니다.');
    } catch (nextError) {
      setError((nextError as Error).message);
    }
  }

  function resetToProjectDefault() {
    if (!activeProject) return;
    const schema = defaultFieldSchema(String(activeProject.project_type));
    setFields(cloneFields(schema.fields));
    setMessage('프로젝트 유형의 기본 필드 구성을 불러왔습니다. 저장해야 적용됩니다.');
  }

  return (
    <section className="rounded-3xl border border-[#EAEAE4] bg-white p-6 shadow-sm">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-xl font-bold text-[#1A1A1A]">템플릿 필드 구성 관리</h3>
          <p className="mt-1 text-sm text-[#888780]">
            프로젝트별로 하위 프로젝트 생성에 사용할 템플릿을 관리합니다.
          </p>
        </div>
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

      {loading ? (
        <p className="py-8 text-center text-sm text-[#888780]">불러오는 중...</p>
      ) : projects.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[#D3D1C7] px-4 py-8 text-center text-sm text-[#888780]">
          등록된 프로젝트가 없습니다.
        </p>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="rounded-2xl border border-[#EAEAE4] bg-[#FAFAFA] p-3">
            <p className="mb-2 px-2 text-xs font-bold text-[#888780]">프로젝트</p>
            <div className="max-h-[620px] space-y-1 overflow-y-auto pr-1">
              {projects.map((project) => {
                const count = Object.values(schemas).filter((schema) =>
                  isTemplateForProject(schema, project.id),
                ).length;
                return (
                  <button
                    key={project.id}
                    type="button"
                    onClick={() => setActiveProjectId(project.id)}
                    className={`w-full rounded-xl px-3 py-2 text-left text-xs font-bold transition ${
                      activeProjectId === project.id
                        ? 'bg-[#534AB7] text-white'
                        : 'text-[#5F5E5A] hover:bg-white'
                    }`}
                  >
                    <span className="block truncate">{project.name}</span>
                    <span className="mt-0.5 block text-[10px] opacity-70">
                      템플릿 {count}개
                    </span>
                  </button>
                );
              })}
            </div>
          </aside>

          <div className="space-y-5">
            <div className="rounded-2xl border border-[#EAEAE4] bg-white p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-[#888780]">선택 프로젝트</p>
                  <h4 className="text-lg font-bold text-[#1A1A1A]">
                    {activeProject?.name}
                  </h4>
                </div>
                <div className="flex flex-wrap gap-2">
                  {activeKey && (
                    <button
                      type="button"
                      onClick={() => void handleDelete()}
                      className="rounded-lg border border-[#F4C9C9] px-3 py-2 text-xs font-bold text-[#A32D2D] hover:bg-[#FFF7F7]"
                    >
                      템플릿 삭제
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleAddTemplate}
                    className="rounded-lg border border-[#D8D3F2] px-3 py-2 text-xs font-bold text-[#534AB7]"
                  >
                    템플릿 추가
                  </button>
                </div>
              </div>

              <div className="mb-3 flex flex-wrap items-end gap-2 rounded-xl border border-[#EAEAE4] bg-[#FAFAFA] p-3">
                <label className="min-w-[220px] flex-1">
                  <span className="mb-1 block text-xs font-bold text-[#888780]">
                    저장된 템플릿 재사용
                  </span>
                  <select
                    value={reuseSourceKey}
                    onChange={(event) => setReuseSourceKey(event.target.value)}
                    className="input w-full"
                  >
                    <option value="">재사용할 템플릿 선택</option>
                    {reusableTemplates.map((schema) => (
                      <option key={schema.project_type} value={String(schema.project_type)}>
                        {schema.section_label}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  onClick={handleReuseTemplate}
                  disabled={!reuseSourceKey || !activeProject}
                  className="rounded-lg border border-[#D8D3F2] px-3 py-2 text-xs font-bold text-[#534AB7] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  선택 템플릿 복사
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                {projectTemplates.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-[#D3D1C7] px-4 py-4 text-sm text-[#888780]">
                    이 프로젝트에 할당된 템플릿이 없습니다. 템플릿을 추가해주세요.
                  </p>
                ) : (
                  projectTemplates.map((schema) => (
                    <button
                      key={schema.project_type}
                      type="button"
                      onClick={() => setActiveKey(String(schema.project_type))}
                      className={`rounded-full px-4 py-1.5 text-xs font-bold transition-colors ${
                        activeKey === schema.project_type
                          ? 'bg-[#534AB7] text-white'
                          : 'border border-[#D3D1C7] text-[#5F5E5A] hover:bg-[#F5F5F0]'
                      }`}
                    >
                      {schema.section_label}
                      <span className="ml-1.5 rounded-full bg-white/30 px-1.5 py-0.5 text-[10px]">
                        필드 {schema.fields.length}
                      </span>
                      <span className="ml-1 rounded-full bg-white/30 px-1.5 py-0.5 text-[10px]">
                        가중치 {schema.weight ?? 5}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>

            {activeKey ? (
              <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
                <div className="space-y-5">
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div className="flex flex-wrap gap-3 flex-1">
                      <label className="block min-w-[240px] max-w-sm flex-1">
                        <span className="mb-2 block text-xs font-bold uppercase tracking-[0.8px] text-[#888780]">
                          템플릿 이름 <span className="text-red-500">*</span>
                        </span>
                        <input
                          value={templateName}
                          onChange={(event) => setTemplateName(event.target.value)}
                          className="input w-full"
                          placeholder="예: 검증 정보"
                        />
                      </label>
                      <label className="block w-[130px]">
                        <span className="mb-2 block text-xs font-bold uppercase tracking-[0.8px] text-[#888780]">
                          가중치 (1~10) <span className="text-red-500">*</span>
                        </span>
                        <select
                          value={templateWeight}
                          onChange={(event) => setTemplateWeight(Number(event.target.value))}
                          className="input w-full"
                        >
                          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                            <option key={n} value={n}>{n}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <button
                      type="button"
                      onClick={resetToProjectDefault}
                      className="rounded-lg border border-[#D3D1C7] px-4 py-2 text-xs font-bold text-[#5F5E5A]"
                    >
                      프로젝트 기본 구성 불러오기
                    </button>
                  </div>

                  <div className="space-y-3">
                    {fields.length === 0 && (
                      <p className="rounded-xl border border-dashed border-[#D3D1C7] px-4 py-6 text-center text-sm text-[#B4B2A9]">
                        아직 정의된 필드가 없습니다.
                      </p>
                    )}
                    {fields.map((field, index) => (
                      <FieldEditor
                        key={index}
                        field={field}
                        index={index}
                        total={fields.length}
                        onChange={(key, value) => updateField(index, key, value)}
                        onMove={(direction) => moveField(index, direction)}
                        onRemove={() =>
                          setFields((current) =>
                            current.filter((_, fieldIndex) => fieldIndex !== index),
                          )
                        }
                        onAddOption={() => addOption(index)}
                        onUpdateOption={(optionIndex, key, value) =>
                          updateOption(index, optionIndex, key, value)
                        }
                        onRemoveOption={(optionIndex) =>
                          removeOption(index, optionIndex)
                        }
                      />
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setFields((current) => [...current, newField(current.length)])
                    }
                    className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#534AB7]/40 py-3 text-sm font-bold text-[#534AB7] hover:border-[#534AB7] hover:bg-[#EEEDFE]/30"
                  >
                    + 필드 추가
                  </button>

                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => void handleSave()}
                      disabled={saving}
                      className="rounded-lg bg-[#534AB7] px-5 py-2 text-xs font-bold text-white disabled:opacity-50 hover:bg-[#433A9A]"
                    >
                      {saving ? '저장 중...' : '저장'}
                    </button>
                  </div>
                </div>

                <TemplatePreview templateName={templateName} fields={sortedFields} />
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-[#D3D1C7] px-4 py-8 text-center text-sm text-[#888780]">
                선택한 프로젝트에 템플릿을 추가하면 필드 구성을 편집할 수 있습니다.
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

type FieldEditorProps = {
  field: FieldDefinition;
  index: number;
  total: number;
  onChange: <K extends keyof FieldDefinition>(
    key: K,
    value: FieldDefinition[K],
  ) => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
  onAddOption: () => void;
  onUpdateOption: (index: number, key: keyof FieldOption, value: string) => void;
  onRemoveOption: (index: number) => void;
};

function FieldEditor({
  field,
  index,
  total,
  onChange,
  onMove,
  onRemove,
  onAddOption,
  onUpdateOption,
  onRemoveOption,
}: FieldEditorProps) {
  return (
    <div className="rounded-2xl border border-[#EAEAE4] bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-xs font-bold text-[#B4B2A9]">
          필드 #{index + 1}
        </span>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => onMove(-1)}
            disabled={index === 0}
            className="rounded px-2 py-1 text-xs text-[#888780] hover:bg-[#F5F5F0] disabled:opacity-30"
          >
            위
          </button>
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={index === total - 1}
            className="rounded px-2 py-1 text-xs text-[#888780] hover:bg-[#F5F5F0] disabled:opacity-30"
          >
            아래
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="ml-1 rounded px-2 py-1 text-xs font-bold text-[#A32D2D] hover:bg-[#FCEBEB]"
          >
            삭제
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <SmallField label="필드 키">
          <input
            value={field.key}
            onChange={(event) =>
              onChange('key', event.target.value.replace(/\s/g, '_'))
            }
            className="input"
            placeholder="예: controller_name"
          />
        </SmallField>
        <SmallField label="표시 이름">
          <input
            value={field.label}
            onChange={(event) => onChange('label', event.target.value)}
            className="input"
            placeholder="예: 제어기명"
          />
        </SmallField>
        <SmallField label="필드 타입">
          <select
            value={field.field_type}
            onChange={(event) =>
              onChange('field_type', event.target.value as FieldType)
            }
            className="input"
          >
            {(Object.entries(FIELD_TYPE_LABEL) as [FieldType, string][]).map(
              ([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ),
            )}
          </select>
        </SmallField>
        <SmallField label="필수 여부">
          <label className="flex h-full items-center gap-2">
            <input
              type="checkbox"
              checked={field.required}
              onChange={(event) => onChange('required', event.target.checked)}
              className="h-4 w-4 accent-[#534AB7]"
            />
            <span className="text-sm text-[#1A1A1A]">필수 입력</span>
          </label>
        </SmallField>
      </div>

      {field.field_type === 'select' && (
        <div className="mt-3 rounded-xl border border-[#EAEAE4] bg-[#FAFAFA] p-3">
          <p className="mb-2 text-xs font-bold text-[#888780]">선택지</p>
          <div className="space-y-2">
            {field.options.map((option, optionIndex) => (
              <div key={optionIndex} className="flex gap-2">
                <input
                  value={option.label}
                  onChange={(event) =>
                    onUpdateOption(optionIndex, 'label', event.target.value)
                  }
                  className="input flex-1"
                  placeholder="표시 이름"
                />
                <input
                  value={option.value}
                  onChange={(event) =>
                    onUpdateOption(optionIndex, 'value', event.target.value)
                  }
                  className="input flex-1"
                  placeholder="값"
                />
                <button
                  type="button"
                  onClick={() => onRemoveOption(optionIndex)}
                  className="shrink-0 rounded-lg border border-[#F4C9C9] px-2 py-1 text-xs font-bold text-[#A32D2D]"
                >
                  삭제
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={onAddOption}
            className="mt-2 text-xs font-bold text-[#534AB7] hover:underline"
          >
            + 선택지 추가
          </button>
        </div>
      )}
    </div>
  );
}

function TemplatePreview({
  templateName,
  fields,
}: {
  templateName: string;
  fields: FieldDefinition[];
}) {
  return (
    <aside className="rounded-2xl border border-[#EAEAE4] bg-[#FCFCFA] p-4 xl:sticky xl:top-4 xl:self-start">
      <div className="mb-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#888780]">
          미리보기
        </p>
        <h4 className="mt-1 text-lg font-bold text-[#1A1A1A]">
          {templateName || '템플릿 이름'}
        </h4>
      </div>

      {fields.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#D3D1C7] px-4 py-8 text-center text-sm text-[#B4B2A9]">
          추가한 필드가 없습니다.
        </div>
      ) : (
        <div className="grid gap-3">
          {fields.map((field) => (
            <PreviewField key={`${field.key}-${field.order}`} field={field} />
          ))}
        </div>
      )}
    </aside>
  );
}

function PreviewField({ field }: { field: FieldDefinition }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold text-[#66645C]">
        {field.label || '필드 이름'}
        {field.required && <span className="ml-0.5 text-red-500">*</span>}
      </span>
      {field.field_type === 'select' ? (
        <select className="input w-full" disabled>
          <option>{field.options[0]?.label || '선택'}</option>
        </select>
      ) : field.field_type === 'textarea' ? (
        <textarea className="input min-h-[72px] w-full" disabled />
      ) : field.field_type === 'checkbox' ? (
        <div className="flex h-10 items-center gap-2 rounded-lg border border-border bg-white px-3">
          <input type="checkbox" disabled className="h-4 w-4" />
          <span className="text-sm text-text-subtle">체크</span>
        </div>
      ) : (
        <input
          type={
            field.field_type === 'number'
              ? 'number'
              : field.field_type === 'date'
                ? 'date'
                : 'text'
          }
          className="input w-full"
          disabled
        />
      )}
    </label>
  );
}

function SmallField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.8px] text-[#888780]">
        {label}
      </span>
      {children}
    </label>
  );
}
