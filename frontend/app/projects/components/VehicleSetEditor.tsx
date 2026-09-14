'use client';

import { useId } from 'react';
import type { ProjectVehicleSet } from '../../lib/api';
import type { VehicleSuggestionKey, VehicleSuggestions } from '../lib/vehicleSuggestions';

type Props = {
  value: ProjectVehicleSet[];
  onChange: (value: ProjectVehicleSet[]) => void;
  disabled?: boolean;
  suggestions?: VehicleSuggestions;
};

const emptyVehicleSet: ProjectVehicleSet = {
  controller_name: '',
  vehicle_type: '',
  controller_country: '',
  controller_version: '',
};

const inputClass =
  'mt-1 h-10 w-full rounded-lg border border-border px-3 py-2 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100';

const FIELDS: Array<{ key: VehicleSuggestionKey; label: string; placeholder: string }> = [
  { key: 'controller_name', label: '제어기명', placeholder: '예: VPC1.1' },
  { key: 'vehicle_type', label: '차종', placeholder: '예: MQ4' },
  { key: 'controller_country', label: '지역', placeholder: '예: DOM' },
  { key: 'controller_version', label: '버전', placeholder: '예: 44H0' },
];

export default function VehicleSetEditor({
  value,
  onChange,
  disabled = false,
  suggestions,
}: Props) {
  const listPrefix = useId();
  const items = value;

  function update(index: number, key: keyof ProjectVehicleSet, nextValue: string) {
    onChange(
      items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [key]: nextValue } : item,
      ),
    );
  }

  function add() {
    onChange([...items, { ...emptyVehicleSet }]);
  }

  function remove(index: number) {
    onChange(items.filter((_, itemIndex) => itemIndex !== index));
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-text">차종 세트</p>
          <p className="mt-1 text-xs text-text-subtle">
            C 프로젝트 생성 시 선택해서 기본 정보를 자동으로 채웁니다.
          </p>
        </div>
        <button
          type="button"
          onClick={add}
          disabled={disabled}
          className="rounded-lg border border-brand-soft bg-white px-3 py-2 text-xs font-bold text-brand transition hover:bg-brand-soft disabled:cursor-not-allowed disabled:opacity-50"
        >
          + 차종 세트 추가
        </button>
      </div>

      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-3 text-xs text-text-subtle">
          추가된 차종 세트가 없습니다. 필요하면 &quot;+ 차종 세트 추가&quot;를 누르세요.
        </p>
      ) : (
        <div className="space-y-3">
          {items.map((item, index) => (
            <div key={index} className="rounded-xl border border-border bg-surface-muted p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-bold text-text-muted">
                  차종 {index + 1}
                </span>
                <button
                  type="button"
                  onClick={() => remove(index)}
                  disabled={disabled}
                  className="text-xs font-bold text-verify-fail-fg disabled:cursor-not-allowed disabled:opacity-40"
                >
                  삭제
                </button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {FIELDS.map((field) => (
                  <VehicleInput
                    key={field.key}
                    label={field.label}
                    value={item[field.key]}
                    onChange={(nextValue) => update(index, field.key, nextValue)}
                    disabled={disabled}
                    placeholder={field.placeholder}
                    listId={`${listPrefix}-${field.key}`}
                    options={suggestions?.[field.key] ?? []}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {suggestions &&
        FIELDS.map((field) =>
          (suggestions[field.key] ?? []).length > 0 ? (
            <datalist key={field.key} id={`${listPrefix}-${field.key}`}>
              {suggestions[field.key].map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>
          ) : null,
        )}
    </div>
  );
}

function VehicleInput({
  label,
  value,
  onChange,
  disabled,
  placeholder,
  listId,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  placeholder: string;
  listId: string;
  options: string[];
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-text-muted">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        list={options.length > 0 ? listId : undefined}
        className={inputClass}
      />
    </label>
  );
}

export function normalizeVehicleSets(items: ProjectVehicleSet[]) {
  return items
    .map((item) => ({
      controller_name: item.controller_name.trim(),
      vehicle_type: item.vehicle_type.trim(),
      controller_country: item.controller_country.trim(),
      controller_version: item.controller_version.trim(),
    }))
    .filter(
      (item) =>
        item.controller_name ||
        item.vehicle_type ||
        item.controller_country ||
        item.controller_version,
    );
}
