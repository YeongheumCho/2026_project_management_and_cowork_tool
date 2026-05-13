'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  apiFetch,
  DEFAULT_PROJECT_FIELD_SCHEMAS,
  defaultFieldSchema,
  type FieldDefinition,
  type FieldOption,
  type FieldType,
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

const DEFAULT_TEMPLATE_KEYS = Object.keys(DEFAULT_PROJECT_FIELD_SCHEMAS);

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

function newTemplateKey() {
  return `template_${Date.now().toString(36)}`;
}

function orderedTemplateKeys(schemas: Record<string, ProjectFieldSchema>) {
  const customKeys = Object.keys(schemas)
    .filter((key) => !DEFAULT_TEMPLATE_KEYS.includes(key))
    .sort((left, right) =>
      schemas[left].section_label.localeCompare(schemas[right].section_label),
    );
  return [...DEFAULT_TEMPLATE_KEYS, ...customKeys];
}

export default function TemplateManager() {
  const [schemas, setSchemas] = useState<Record<string, ProjectFieldSchema>>({});
  const [activeKey, setActiveKey] = useState('regular_inspection');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [templateName, setTemplateName] = useState('검증 정보');
  const [fields, setFields] = useState<FieldDefinition[]>([]);

  const templateKeys = useMemo(() => orderedTemplateKeys(schemas), [schemas]);
  const sortedFields = useMemo(
    () => fields.slice().sort((a, b) => a.order - b.order),
    [fields],
  );
  const isDefaultTemplate = DEFAULT_TEMPLATE_KEYS.includes(activeKey);

  useEffect(() => {
    void loadSchemas();
  }, []);

  useEffect(() => {
    const schema = schemas[activeKey] ?? defaultFieldSchema(activeKey);
    setTemplateName(schema.section_label);
    setFields(schema.fields.slice().sort((a, b) => a.order - b.order));
    setMessage('');
    setError('');
  }, [activeKey, schemas]);

  async function loadSchemas() {
    setLoading(true);
    try {
      const saved = await apiFetch<ProjectFieldSchema[]>('/field-schemas');
      const next = Object.fromEntries(
        DEFAULT_TEMPLATE_KEYS.map((key) => [key, defaultFieldSchema(key)]),
      ) as Record<string, ProjectFieldSchema>;
      for (const schema of saved) {
        next[schema.project_type] = schema;
      }
      setSchemas(next);
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

  async function handleAddTemplate() {
    const key = newTemplateKey();
    const nextSchema: ProjectFieldSchema = {
      id: 0,
      project_type: key,
      section_label: '새 템플릿',
      fields: [],
      created_by: null,
      updated_at: new Date().toISOString(),
    };
    setSchemas((current) => ({ ...current, [key]: nextSchema }));
    setActiveKey(key);
    setMessage('새 템플릿을 추가했습니다. 이름과 필드를 설정한 뒤 저장해주세요.');
  }

  async function handleSave() {
    const normalizedFields = normalizeFields();
    const keys = normalizedFields.map((field) => field.key).filter(Boolean);

    if (!templateName.trim()) {
      setError('템플릿 이름을 입력해주세요.');
      return;
    }
    if (
      Object.entries(schemas).some(
        ([key, schema]) =>
          key !== activeKey && schema.section_label === templateName.trim(),
      )
    ) {
      setError('같은 이름의 템플릿이 이미 있습니다.');
      return;
    }
    if (keys.length !== normalizedFields.length) {
      setError('모든 필드에 고유 키를 입력해주세요.');
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
            section_label: templateName.trim(),
            fields: normalizedFields,
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
    const schema = schemas[activeKey] ?? defaultFieldSchema(activeKey);
    const actionLabel = isDefaultTemplate ? '기본값으로 되돌릴까요?' : '삭제할까요?';
    if (!window.confirm(`"${schema.section_label}" 템플릿을 ${actionLabel}`)) return;

    try {
      await apiFetch<void>(`/field-schemas/${activeKey}`, { method: 'DELETE' });
      if (isDefaultTemplate) {
        setSchemas((current) => ({
          ...current,
          [activeKey]: defaultFieldSchema(activeKey),
        }));
        setMessage('기본 템플릿 구성으로 되돌렸습니다.');
      } else {
        setSchemas((current) => {
          const next = { ...current };
          delete next[activeKey];
          return next;
        });
        setActiveKey('regular_inspection');
        setMessage('템플릿을 삭제했습니다.');
      }
    } catch (nextError) {
      setError((nextError as Error).message);
    }
  }

  function resetToDefault() {
    const schema = defaultFieldSchema(activeKey);
    setTemplateName(schema.section_label);
    setFields(schema.fields.map((field) => ({ ...field })));
    setMessage('저장 버튼을 누르면 기본 구성이 적용됩니다.');
  }

  return (
    <section className="rounded-3xl border border-[#EAEAE4] bg-white p-6 shadow-sm">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-xl font-bold text-[#1A1A1A]">템플릿 관리</h3>
          <p className="mt-1 text-sm text-[#888780]">
            하위 프로젝트 추가/수정 모달에 표시될 입력 필드 템플릿을 관리합니다.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleAddTemplate()}
          className="rounded-lg bg-[#534AB7] px-4 py-2 text-xs font-bold text-white hover:bg-[#433A9A]"
        >
          + 템플릿 추가
        </button>
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

      <div className="mb-5 flex flex-wrap gap-2">
        {templateKeys.map((key) => {
          const schema = schemas[key] ?? defaultFieldSchema(key);
          return (
            <button
              key={key}
              type="button"
              onClick={() => setActiveKey(key)}
              className={`rounded-full px-4 py-1.5 text-xs font-bold transition-colors ${
                activeKey === key
                  ? 'bg-[#534AB7] text-white'
                  : 'border border-[#D3D1C7] text-[#5F5E5A] hover:bg-[#F5F5F0]'
              }`}
            >
              {schema.section_label}
              {schema.fields.length ? (
                <span className="ml-1.5 rounded-full bg-white/30 px-1.5 py-0.5 text-[10px]">
                  {schema.fields.length}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {loading ? (
        <p className="py-8 text-center text-sm text-[#888780]">불러오는 중...</p>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="space-y-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <label className="block min-w-[240px] max-w-sm flex-1">
                <span className="mb-2 block text-xs font-bold uppercase tracking-[0.8px] text-[#888780]">
                  템플릿 이름
                </span>
                <input
                  value={templateName}
                  onChange={(event) => setTemplateName(event.target.value)}
                  className="input w-full"
                  placeholder="예: 검증 정보"
                />
              </label>
              <button
                type="button"
                onClick={resetToDefault}
                className="rounded-lg border border-[#D3D1C7] px-4 py-2 text-xs font-bold text-[#5F5E5A]"
              >
                기본 구성 불러오기
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

            <div className="flex justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={() => void handleDelete()}
                className="rounded-lg border border-[#F4C9C9] px-4 py-2 text-xs font-bold text-[#A32D2D]"
              >
                {isDefaultTemplate ? '기본값으로 되돌리기' : '템플릿 삭제'}
              </button>
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
        <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#888780]">
          미리보기
        </p>
        <h4 className="mt-1 text-[15px] font-bold text-[#1A1A1A]">
          {templateName || '템플릿 이름'}
        </h4>
      </div>

      {fields.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#D3D1C7] px-4 py-8 text-center text-sm text-[#B4B2A9]">
          추가된 필드가 없습니다.
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
        <div className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3">
          <input type="checkbox" disabled className="h-4 w-4" />
          <span className="text-sm text-slate-500">체크</span>
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
