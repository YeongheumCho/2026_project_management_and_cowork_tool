'use client';

import type { ProjectVehicleSet } from '../../lib/api';

type Props = {
  value: ProjectVehicleSet[];
  onChange: (value: ProjectVehicleSet[]) => void;
  disabled?: boolean;
};

const emptyVehicleSet: ProjectVehicleSet = {
  controller_name: '',
  vehicle_type: '',
  controller_country: '',
  controller_version: '',
};

const inputClass =
  'mt-1 h-10 w-full rounded-lg border border-border px-3 py-2 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100';

export default function VehicleSetEditor({ value, onChange, disabled = false }: Props) {
  const items = value.length > 0 ? value : [{ ...emptyVehicleSet }];

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
    const next = items.filter((_, itemIndex) => itemIndex !== index);
    onChange(next.length > 0 ? next : [{ ...emptyVehicleSet }]);
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
          + 세트 추가
        </button>
      </div>

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
                disabled={disabled || items.length === 1}
                className="text-xs font-bold text-verify-fail-fg disabled:cursor-not-allowed disabled:opacity-40"
              >
                삭제
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <VehicleInput
                label="제어기명"
                value={item.controller_name}
                onChange={(nextValue) => update(index, 'controller_name', nextValue)}
                disabled={disabled}
                placeholder="예: VPC1.1"
              />
              <VehicleInput
                label="차종"
                value={item.vehicle_type}
                onChange={(nextValue) => update(index, 'vehicle_type', nextValue)}
                disabled={disabled}
                placeholder="예: MQ4"
              />
              <VehicleInput
                label="지역"
                value={item.controller_country}
                onChange={(nextValue) => update(index, 'controller_country', nextValue)}
                disabled={disabled}
                placeholder="예: DOM"
              />
              <VehicleInput
                label="버전"
                value={item.controller_version}
                onChange={(nextValue) => update(index, 'controller_version', nextValue)}
                disabled={disabled}
                placeholder="예: 44H0"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function VehicleInput({
  label,
  value,
  onChange,
  disabled,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  placeholder: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-text-muted">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        placeholder={placeholder}
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
