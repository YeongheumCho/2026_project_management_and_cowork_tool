import type { EquipmentColumn } from '../lib/api';

/** 한 줄의 값. { "<열 id>": 값 } */
export type EquipmentValues = Record<string, string>;

/** 시트에서 IP 칸 머리글이 '-' 였으므로 CSV 에서는 그것도 IP 로 읽는다. */
const HEADER_ALIASES: Record<string, string> = { '-': 'IP' };

function normalizeLabel(label: string): string {
  return label.replace(/^﻿/, '').trim().toLowerCase().replace(/\s+/g, '');
}

export function sameValues(
  a: EquipmentValues,
  b: EquipmentValues,
  columns: EquipmentColumn[],
): boolean {
  return columns.every(({ id }) => (a[id] ?? '').trim() === (b[id] ?? '').trim());
}

/** 저장할 값: 지금 있는 열만, 빈칸은 뺀다. */
export function cleanValues(values: EquipmentValues, columns: EquipmentColumn[]): EquipmentValues {
  const next: EquipmentValues = {};
  for (const { id } of columns) {
    const value = (values[id] ?? '').trim();
    if (value) next[id] = value;
  }
  return next;
}

/** 분류 버튼용: 첫 열 값에서 끝 숫자를 뗀 것. 검증용1 → 검증용 */
export function equipmentGroup(values: EquipmentValues, columns: EquipmentColumn[]): string {
  const first = columns[0] ? (values[columns[0].id] ?? '') : '';
  return first.replace(/\s*\d+\s*$/, '').trim() || '기타';
}

function csvCell(value: string | undefined): string {
  const text = value ?? '';
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(columns: EquipmentColumn[], rows: EquipmentValues[]): string {
  const header = columns.map((column) => csvCell(column.label)).join(',');
  const body = rows.map((row) => columns.map(({ id }) => csvCell(row[id])).join(','));
  // 엑셀이 한글을 UTF-8 로 읽도록 BOM 을 붙인다.
  return '﻿' + [header, ...body].join('\r\n') + '\r\n';
}

/** CSV 머리글 중 지금 표에 없는 열 이름 (가져오기 전에 새 열로 만든다). */
export function missingHeaders(header: string[], columns: EquipmentColumn[]): string[] {
  const known = new Set(columns.map((column) => normalizeLabel(column.label)));
  const missing: string[] = [];
  for (const cell of header) {
    const label = cell.replace(/^﻿/, '').trim();
    if (!label) continue;
    const alias = HEADER_ALIASES[label];
    if (known.has(normalizeLabel(label)) || (alias && known.has(normalizeLabel(alias)))) continue;
    if (!missing.includes(label)) missing.push(label);
  }
  return missing;
}

/**
 * CSV 줄 배열 → 줄 값. 첫 줄은 머리글이고, 열 이름으로 맞춘다.
 * 모든 칸이 빈 줄은 건너뛴다.
 */
export function fromCsv(lines: string[][], columns: EquipmentColumn[]): EquipmentValues[] {
  const [header, ...body] = lines;
  if (!header) return [];
  const byLabel = new Map(columns.map((column) => [normalizeLabel(column.label), String(column.id)]));
  const ids = header.map((cell) => {
    const label = cell.replace(/^﻿/, '').trim();
    return byLabel.get(normalizeLabel(label)) ?? byLabel.get(normalizeLabel(HEADER_ALIASES[label] ?? '')) ?? null;
  });
  const rows: EquipmentValues[] = [];
  for (const cells of body) {
    const row: EquipmentValues = {};
    ids.forEach((id, index) => {
      const value = (cells[index] ?? '').trim();
      if (id && value) row[id] = value;
    });
    if (Object.keys(row).length > 0) rows.push(row);
  }
  return rows;
}
