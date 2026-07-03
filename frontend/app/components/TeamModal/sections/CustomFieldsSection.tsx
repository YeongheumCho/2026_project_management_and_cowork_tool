'use client';

import type { FieldDefinition, FieldOption, ProjectFieldSchema, UserBrief } from '../../../lib/api';
import OrganizationMemberPicker from '../../OrganizationMemberPicker';
import Field from '../../form/Field';

type Props = {
  schema: ProjectFieldSchema;
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  optionsForField?: (field: FieldDefinition) => FieldOption[] | undefined;
  disabled?: boolean;
  roleUsers?: UserBrief[];
  roleSelections?: Record<string, number[]>;
  onRoleSelectionChange?: (key: string, userIds: number[]) => void;
};

export default function CustomFieldsSection({
  schema,
  values,
  onChange,
  optionsForField,
  disabled = false,
  roleUsers = [],
  roleSelections = {},
  onRoleSelectionChange,
}: Props) {
  if (schema.fields.length === 0) return null;

  const sorted = [...schema.fields].sort((a, b) => a.order - b.order);

  return (
    <section className="rounded-xl border border-border p-4">
      <h4 className="mb-3 text-sm font-semibold text-text">
        {schema.section_label}
      </h4>
      <div className="grid gap-3 sm:grid-cols-3">
        {sorted.map((field) => {
          if (isMultiRoleField(field.key) && onRoleSelectionChange) {
            return (
              <Field key={field.key} label={field.label} full required={field.required}>
                <div className="max-h-[240px] overflow-y-auto rounded-xl border border-border bg-surface-muted p-3">
                  <OrganizationMemberPicker
                    users={roleUsers}
                    selectedIds={roleSelections[field.key] ?? []}
                    onChange={(userIds) => onRoleSelectionChange(field.key, userIds)}
                    disabled={disabled}
                  />
                </div>
              </Field>
            );
          }
          return (
            <FieldInput
              key={field.key}
              field={field}
              value={values[field.key] ?? ''}
              options={optionsForField?.(field) ?? field.options ?? []}
              onChange={(value) => onChange(field.key, value)}
              disabled={disabled}
            />
          );
        })}
      </div>
    </section>
  );
}

function isMultiRoleField(key: string) {
  return key === 'verifier_id' || key === 'reviewer_id' || key === 'inreviewer_id';
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
  const { label } = field;

  switch (field.field_type) {
    case 'select':
      return (
        <Field label={label} required={field.required}>
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
        <Field label={label} required={field.required}>
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
        <Field label={label} required={field.required}>
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
        <Field label={label} required={field.required}>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={value === 'true'}
              onChange={(event) => onChange(event.target.checked ? 'true' : 'false')}
              disabled={disabled}
              className="h-4 w-4 accent-brand"
            />
            <span className="text-sm text-text">{field.label}</span>
          </label>
        </Field>
      );

    case 'textarea':
      return (
        <Field label={label} full required={field.required}>
          <textarea
            value={value}
            onChange={(event) => onChange(event.target.value)}
            disabled={disabled}
            className="input min-h-[72px]"
          />
        </Field>
      );

    default: {
      const listId = options.length > 0 ? `field-options-${field.key}` : undefined;
      return (
        <Field label={label} required={field.required}>
          <>
            <input
              type="text"
              value={value}
              list={listId}
              onChange={(event) => onChange(event.target.value)}
              disabled={disabled}
              className="input"
            />
            {listId && (
              <datalist id={listId}>
                {options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </datalist>
            )}
          </>
        </Field>
      );
    }
  }
}
