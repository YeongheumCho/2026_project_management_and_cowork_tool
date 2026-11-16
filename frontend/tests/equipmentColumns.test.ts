import { describe, expect, it } from 'vitest';
import type { EquipmentColumn } from '../app/lib/api';
import {
  cleanFormats,
  cleanValues,
  equipmentGroup,
  fromCsv,
  missingHeaders,
  parseCsvText,
  patchFormat,
  sameFormats,
  sameValues,
  toCsv,
} from '../app/equipment/columns';

const columns: EquipmentColumn[] = [
  { id: 1, label: '장비', sort_order: 0 },
  { id: 2, label: 'IP', sort_order: 1 },
  { id: 3, label: '비고', sort_order: 2 },
];

describe('parseCsvText', () => {
  it('따옴표 안의 쉼표와 줄바꿈을 한 칸으로 읽는다', () => {
    const rows = parseCsvText('장비,비고\r\n검증용1,"첫 줄\n둘째 줄, 쉼표"\r\n\r\n업무용1,\n');
    expect(rows).toEqual([
      ['장비', '비고'],
      ['검증용1', '첫 줄\n둘째 줄, 쉼표'],
      ['업무용1', ''],
    ]);
  });

  it('따옴표 두 개는 따옴표 하나로 읽는다', () => {
    expect(parseCsvText('a\n"그가 ""안녕"" 했다"')).toEqual([['a'], ['그가 "안녕" 했다']]);
  });
});

describe('fromCsv / missingHeaders', () => {
  it("시트의 '-' 머리글은 IP 로 읽고, 빈 줄은 건너뛴다", () => {
    const lines = parseCsvText('\uFEFF장비,-,비고\n검증용1,.12.123,\n,,\n');
    expect(missingHeaders(lines[0], columns)).toEqual([]);
    expect(fromCsv(lines, columns)).toEqual([{ '1': '검증용1', '2': '.12.123' }]);
  });

  it('표에 없는 머리글을 알려 준다 (가져오기 전에 새 열로 만든다)', () => {
    expect(missingHeaders(['장비', '위치', ' 위치 '], columns)).toEqual(['위치']);
  });
});

describe('값 비교·정리', () => {
  it('앞뒤 공백만 다르면 같은 값으로 본다', () => {
    expect(sameValues({ 1: 'a' }, { 1: ' a ' }, columns)).toBe(true);
    expect(sameValues({ 1: 'a' }, { 1: 'b' }, columns)).toBe(false);
  });

  it('빈칸과 지운 열의 값은 저장하지 않는다', () => {
    expect(cleanValues({ 1: ' 검증용1 ', 2: '   ', 99: '지운 열' }, columns)).toEqual({ 1: '검증용1' });
  });

  it('첫 열의 끝 숫자를 떼어 분류한다', () => {
    expect(equipmentGroup({ 1: '검증용11' }, columns)).toBe('검증용');
    expect(equipmentGroup({}, columns)).toBe('기타');
  });

  it('CSV 로 내보낸 것을 다시 읽으면 같은 값이 된다', () => {
    const rows = [{ '1': '검증용1', '3': '첫 줄\n둘째 줄, "따옴표"' }];
    expect(fromCsv(parseCsvText(toCsv(columns, rows)), columns)).toEqual(rows);
  });
});

describe('B-109: 칸 서식', () => {
  const cols = [
    { id: 1, label: '장비', sort_order: 0 },
    { id: 2, label: 'IP', sort_order: 1 },
  ];

  it('바꿀 것만 덮어쓰고, null 이면 그 서식을 지운다', () => {
    const bold = patchFormat(undefined, { bold: true });
    expect(bold).toEqual({ bold: true });
    const filled = patchFormat(bold, { bg: '#fff2cc' });
    expect(filled).toEqual({ bold: true, bg: '#fff2cc' });
    expect(patchFormat(filled, { bg: null, bold: false })).toEqual({});
  });

  it('서식이 없는 칸과 지운 열의 서식은 저장하지 않는다', () => {
    expect(cleanFormats({ 1: { bg: '#fff2cc' }, 2: {}, 9: { bold: true } }, cols)).toEqual({
      1: { bg: '#fff2cc' },
    });
  });

  it('빈 서식과 서식 없음은 같은 것으로 본다', () => {
    expect(sameFormats({ 1: {} }, {}, cols)).toBe(true);
    expect(sameFormats({ 1: { bold: true } }, {}, cols)).toBe(false);
  });
});
