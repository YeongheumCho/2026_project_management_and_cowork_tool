import type { EquipmentFields } from '../lib/api';

export type EquipmentKey = keyof EquipmentFields;

/** 표·CSV·이력이 함께 쓰는 열 정의. 순서는 시트16 그대로. */
export const EQUIPMENT_COLUMNS: { key: EquipmentKey; label: string; width: string }[] = [
  { key: 'name', label: '장비', width: 'w-28' },
  { key: 'equipment_no', label: '장비 번호', width: 'w-20' },
  { key: 'owner_name', label: '성명', width: 'w-24' },
  { key: 'owner_idnum', label: '사번', width: 'w-24' },
  { key: 'ip', label: 'IP', width: 'w-28' },
  { key: 'pc_no', label: 'PC번호', width: 'w-24' },
  { key: 'user_name', label: '사용자', width: 'w-24' },
  { key: 'controller', label: '제어기', width: 'w-32' },
  { key: 'prof', label: 'Prof', width: 'w-20' },
  { key: 'col_582', label: '582', width: 'w-20' },
  { key: 'daas_password', label: 'Daas', width: 'w-28' },
  { key: 'internal_password', label: '내부', width: 'w-28' },
  { key: 'note', label: '비고', width: 'w-40' },
];

export const EQUIPMENT_LABEL: Record<string, string> = Object.fromEntries(
  EQUIPMENT_COLUMNS.map((column) => [column.key, column.label]),
);

/** CSV 머리글 → 열. 시트에서 IP 칸 머리글이 '-' 였으므로 그것도 받는다. */
const HEADER_ALIASES: Record<string, EquipmentKey> = {
  ...Object.fromEntries(EQUIPMENT_COLUMNS.map((column) => [column.label, column.key])),
  '-': 'ip',
  장비번호: 'equipment_no',
  pc번호: 'pc_no',
  prof: 'prof',
  daas: 'daas_password',
};

export function emptyEquipment(): EquipmentFields {
  return {
    name: '',
    equipment_no: null,
    owner_name: null,
    owner_idnum: null,
    ip: null,
    pc_no: null,
    user_name: null,
    controller: null,
    prof: null,
    col_582: null,
    daas_password: null,
    internal_password: null,
    note: null,
  };
}

export function pickFields(row: EquipmentFields): EquipmentFields {
  const next = emptyEquipment();
  for (const { key } of EQUIPMENT_COLUMNS) {
    (next as Record<EquipmentKey, string | null>)[key] = row[key] ?? null;
  }
  next.name = row.name ?? '';
  return next;
}

export function sameFields(a: EquipmentFields, b: EquipmentFields): boolean {
  return EQUIPMENT_COLUMNS.every(({ key }) => (a[key] ?? '') === (b[key] ?? ''));
}

function csvCell(value: string | null): string {
  const text = value ?? '';
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(rows: EquipmentFields[]): string {
  const header = EQUIPMENT_COLUMNS.map((column) => column.label).join(',');
  const body = rows.map((row) => EQUIPMENT_COLUMNS.map(({ key }) => csvCell(row[key])).join(','));
  // 엑셀이 한글을 UTF-8 로 읽도록 BOM 을 붙인다.
  return '﻿' + [header, ...body].join('\r\n') + '\r\n';
}

/**
 * CSV 줄 배열 → 장비 행. 첫 줄은 머리글.
 * 모르는 열은 무시하고, 장비 이름이 빈 줄은 건너뛴다.
 */
export function fromCsv(
  lines: string[][],
): { rows: EquipmentFields[]; skipped: number; unknownHeaders: string[] } {
  const [header, ...body] = lines;
  if (!header) return { rows: [], skipped: 0, unknownHeaders: [] };
  const keys = header.map((cell) => {
    const raw = cell.replace(/^﻿/, '').trim();
    return HEADER_ALIASES[raw] ?? HEADER_ALIASES[raw.toLowerCase().replace(/\s+/g, '')] ?? null;
  });
  const unknownHeaders = header.filter((cell, index) => cell.trim() && keys[index] === null);

  let skipped = 0;
  const rows: EquipmentFields[] = [];
  for (const cells of body) {
    if (cells.every((cell) => !cell.trim())) continue;
    const row = emptyEquipment();
    keys.forEach((key, index) => {
      if (!key) return;
      const value = (cells[index] ?? '').trim();
      (row as Record<EquipmentKey, string | null>)[key] = value || null;
    });
    row.name = row.name ?? '';
    if (!row.name) {
      skipped += 1;
      continue;
    }
    rows.push(row);
  }
  return { rows, skipped, unknownHeaders };
}

/** 장비 이름 앞부분(숫자 앞)으로 묶는다. 검증용1 → 검증용 */
export function equipmentGroup(name: string): string {
  return name.replace(/\s*\d+\s*$/, '').trim() || '기타';
}
