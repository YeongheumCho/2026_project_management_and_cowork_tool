'use client';

import type { FieldDefinition, FieldOption, ProjectFieldSchema } from '../../../lib/api';
import Field from '../../form/Field';

type Props = {
  schema: ProjectFieldSchema;
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  optionsForField?: (field: FieldDefinition) => FieldOption[] | undefined;
  disabled?: boolean;
};

export default function CustomFieldsSection({
  schema,
  values,
  onChange,
  optionsForField,
  disabled = false,
}: Props) {
  if (schema.fields.length === 0) return null;

  const sorted = [...schema.fields].sort((a, b) => a.order - b.order);

  return (
    <section className="rounded-xl border border-slate-200 p-4">
      <h4 className="mb-3 text-sm font-semibold text-slate-700">
        {schema.section_label}
      </h4>
      <div className="grid gap-3 sm:grid-cols-3">
        {sorted.map((field) => (
          <FieldInput
            key={field.key}
            field={field}
            value={values[field.key] ?? ''}
            options={optionsForField?.(field) ?? field.options ?? []}
            onChange={(value) => onChange(field.key, value)}
            disabled={disabled}
          />
        ))}
      </div>
    </section>
  );
}

type FieldInputProps = {
  field: FieldDefinition;
  value: string;
  options: FieldOption[];
  onChange: (value: string) => void;
  disabled: boolean;
};

function FieldInput({
  field,
  value,
  options,
  onChange,
  disabled,
}: FieldInputProps) {
  const label = field.label + (field.required ? ' *' : '');

  switch (field.field_type) {
    case 'select':
      return (
        <Field label={label}>
          <select
            value={value}
            onChange={(event) => onChange(event.target.value)}
            disabled={disabled}
            className="input"
          >
            <option value="">선택</option>
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
      );

    case 'number':
      return (
        <Field label={label}>
          <input
            type="number"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            disabled={disabled}
            className="input"
          />
        </Field>
      );

    case 'date':
      return (
        <Field label={label}>
          <input
            type="date"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            disabled={disabled}
            className="input"
          />
        </Field>
      );

    case 'checkbox':
      return (
        <Field label={label}>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={value === 'true'}
              onChange={(event) => onChange(event.target.checked ? 'true' : 'false')}
              disabled={disabled}
              className="h-4 w-4 accent-[#534AB7]"
            />
            <span className="text-sm text-slate-700">{field.label}</span>
          </label>
        </Field>
      );

    case 'textarea':
      return (
        <Field label={label} full>
          <textarea
            value={value}
            onChange={(event) => onChange(event.target.value)}
            disabled={disabled}
            className="input min-h-[72px]"
          />
        </Field>
      );

    default:
      return (
        <Field label={label}>
          <input
            type="text"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            disabled={disabled}
            className="input"
          />
        </Field>
      );
  }
}
