'use client';

import { EXPORT_HEADERS as SHARED_EXPORT_HEADERS } from './subprojectCsvColumns';
import {
  PROJECT_TYPE_LABEL,
  VERIFICATION_LEVEL_LABEL,
  VERIFY_STATE_LABEL,
  type Project,
  type SubProject,
} from '../../lib/api';
import { SUBPROJECT_STATUS_LABEL } from '../../lib/subprojectStatus';

type ExportCell = string | number;

const EXPORT_HEADERS = SHARED_EXPORT_HEADERS;

/**
 * 한 행의 칸 수를 머리글 수와 같게 강제한다.
 * 예전에는 행이 머리글보다 두 칸 많아, 엑셀에서 마지막 두 열에 이름이 없었고
 * 그 파일을 고쳐서 다시 가져오면 열이 어긋났다. 이제 어긋나면 컴파일이 깨진다.
 */
type Repeat<T, N extends number, R extends T[] = []> = R['length'] extends N
  ? R
  : Repeat<T, N, [...R, T]>;
type ExportRow = Repeat<ExportCell, (typeof EXPORT_HEADERS)['length']>;

const XLSX_FILES = [
  {
    path: '[Content_Types].xml',
    content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`,
  },
  {
    path: '_rels/.rels',
    content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`,
  },
  {
    path: 'xl/_rels/workbook.xml.rels',
    content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`,
  },
  {
    path: 'xl/workbook.xml',
    content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="입력 데이터" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`,
  },
];

function assigneeLabel(sp: SubProject) {
  if (sp.assignees?.length) return sp.assignees.map((assignee) => assignee.name).join(', ');
  return sp.assignee?.name ?? '';
}

function boolLabel(value: boolean | undefined) {
  return value ? 'Y' : 'N';
}

function valueOrEmpty(value: string | number | null | undefined): ExportCell {
  return value ?? '';
}

function jsonOrEmpty(value: Record<string, unknown> | null | undefined) {
  if (!value || Object.keys(value).length === 0) return '';
  return JSON.stringify(value);
}

export type ExportOptions = {
  /** '프로젝트원 선택' 유형 필드 키 — 값(쉼표로 이은 사용자 id)을 이름으로 바꿔 내보낸다. */
  memberFieldKeys?: Iterable<string>;
  users?: Array<{ id: number; name: string }>;
};

function withMemberNames(
  customFields: Record<string, unknown> | null | undefined,
  options: ExportOptions,
) {
  const memberKeys = new Set(options.memberFieldKeys ?? []);
  if (!customFields || memberKeys.size === 0) return customFields;
  const nameById = new Map((options.users ?? []).map((user) => [user.id, user.name]));
  const next: Record<string, unknown> = { ...customFields };
  for (const key of memberKeys) {
    const raw = next[key];
    if (typeof raw !== 'string' || raw.trim() === '') continue;
    next[key] = raw
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((id) => nameById.get(Number(id)) ?? id)
      .join(', ');
  }
  return next;
}

function rowsForProject(
  project: Project,
  subprojects: SubProject[],
  options: ExportOptions,
): ExportRow[] {
  const majorProjectName = project.major_project?.name ?? '';
  const projectTypeLabel = PROJECT_TYPE_LABEL[project.project_type] ?? project.project_type;

  return subprojects.map((sp) => [
    majorProjectName,
    project.name,
    projectTypeLabel,
    sp.name,
    assigneeLabel(sp),
    sp.start_date,
    sp.end_date,
    SUBPROJECT_STATUS_LABEL[sp.status],
    Math.round(sp.progress),
    valueOrEmpty(sp.priority),
    valueOrEmpty(sp.controller_name),
    valueOrEmpty(sp.controller_version),
    valueOrEmpty(sp.controller_country),
    valueOrEmpty(sp.to_number),
    valueOrEmpty(sp.to_assignee),
    sp.verification_level ? VERIFICATION_LEVEL_LABEL[sp.verification_level] : '',
    valueOrEmpty(sp.vehicle_type),
    valueOrEmpty(sp.function_name),
    valueOrEmpty(sp.function_owner),
    sp.verifier?.name ?? '',
    sp.reviewer?.name ?? '',
    valueOrEmpty(sp.seat_no),
    valueOrEmpty(sp.controller_no),
    valueOrEmpty(sp.avg_expected_minutes),
    valueOrEmpty(sp.weight),
    boolLabel(sp.upload_done),
    valueOrEmpty(sp.completed_on),
    sp.first_verify_status ? VERIFY_STATE_LABEL[sp.first_verify_status] : '',
    valueOrEmpty(sp.first_setup_min),
    valueOrEmpty(sp.first_aud_min),
    valueOrEmpty(sp.first_review_min),
    sp.inreview_status ? VERIFY_STATE_LABEL[sp.inreview_status] : '',
    valueOrEmpty(sp.inreview_setup_min),
    valueOrEmpty(sp.inreview_aud_min),
    valueOrEmpty(sp.inreview_feedback_min),
    valueOrEmpty(sp.cr_no),
    valueOrEmpty(sp.ip_addr),
    valueOrEmpty(sp.change_feedback_min),
    valueOrEmpty(sp.change_revalidate_min),
    valueOrEmpty(sp.lin_std_hold_note),
    valueOrEmpty(sp.etc_category),
    valueOrEmpty(sp.etc_month),
    valueOrEmpty(sp.etc_days),
    valueOrEmpty(sp.etc_note),
    valueOrEmpty(sp.special_note),
    valueOrEmpty(sp.issue_note),
    jsonOrEmpty(withMemberNames(sp.custom_fields, options)),
  ]);
}

function sanitizeFilename(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, '_').trim() || 'project';
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function csvCell(value: ExportCell) {
  const text = String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function xmlCell(value: ExportCell) {
  const text = String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return `<c t="inlineStr"><is><t>${text}</t></is></c>`;
}

function worksheetXml(rows: ExportRow[]) {
  const allRows = [EXPORT_HEADERS, ...rows];
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    ${allRows
      .map(
        (row, index) =>
          `<row r="${index + 1}">${row.map((cell) => xmlCell(cell)).join('')}</row>`,
      )
      .join('')}
  </sheetData>
</worksheet>`;
}

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeUint16(target: number[], value: number) {
  target.push(value & 0xff, (value >>> 8) & 0xff);
}

function writeUint32(target: number[], value: number) {
  target.push(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff);
}

function createZip(files: Array<{ path: string; content: string }>) {
  const encoder = new TextEncoder();
  const output: number[] = [];
  const centralDirectory: number[] = [];

  for (const file of files) {
    const nameBytes = encoder.encode(file.path);
    const data = encoder.encode(file.content);
    const crc = crc32(data);
    const localOffset = output.length;

    writeUint32(output, 0x04034b50);
    writeUint16(output, 20);
    writeUint16(output, 0);
    writeUint16(output, 0);
    writeUint16(output, 0);
    writeUint16(output, 0);
    writeUint32(output, crc);
    writeUint32(output, data.length);
    writeUint32(output, data.length);
    writeUint16(output, nameBytes.length);
    writeUint16(output, 0);
    output.push(...nameBytes, ...data);

    writeUint32(centralDirectory, 0x02014b50);
    writeUint16(centralDirectory, 20);
    writeUint16(centralDirectory, 20);
    writeUint16(centralDirectory, 0);
    writeUint16(centralDirectory, 0);
    writeUint16(centralDirectory, 0);
    writeUint16(centralDirectory, 0);
    writeUint32(centralDirectory, crc);
    writeUint32(centralDirectory, data.length);
    writeUint32(centralDirectory, data.length);
    writeUint16(centralDirectory, nameBytes.length);
    writeUint16(centralDirectory, 0);
    writeUint16(centralDirectory, 0);
    writeUint16(centralDirectory, 0);
    writeUint16(centralDirectory, 0);
    writeUint32(centralDirectory, 0);
    writeUint32(centralDirectory, localOffset);
    centralDirectory.push(...nameBytes);
  }

  const centralOffset = output.length;
  output.push(...centralDirectory);
  writeUint32(output, 0x06054b50);
  writeUint16(output, 0);
  writeUint16(output, 0);
  writeUint16(output, files.length);
  writeUint16(output, files.length);
  writeUint32(output, centralDirectory.length);
  writeUint32(output, centralOffset);
  writeUint16(output, 0);

  return new Blob([new Uint8Array(output)], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

export function exportSubprojectsCsv(
  project: Project,
  subprojects: SubProject[],
  options: ExportOptions = {},
) {
  const rows = rowsForProject(project, subprojects, options);
  const csv = `\uFEFF${[EXPORT_HEADERS, ...rows]
    .map((row) => row.map(csvCell).join(','))
    .join('\n')}`;
  downloadBlob(
    new Blob([csv], { type: 'text/csv;charset=utf-8;' }),
    `${sanitizeFilename(project.name)}_입력데이터.csv`,
  );
}

export function exportSubprojectsXlsx(
  project: Project,
  subprojects: SubProject[],
  options: ExportOptions = {},
) {
  const rows = rowsForProject(project, subprojects, options);
  const blob = createZip([
    ...XLSX_FILES,
    { path: 'xl/worksheets/sheet1.xml', content: worksheetXml(rows) },
  ]);
  downloadBlob(blob, `${sanitizeFilename(project.name)}_입력데이터.xlsx`);
}
