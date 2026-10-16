import { describe, expect, it } from 'vitest';
import type { EquipmentColumn } from '../app/lib/api';
import { neutralizeCsvFormula, restoreCsvFormula } from '../app/lib/csvSafety';
import { fromCsv, parseCsvText, toCsv } from '../app/equipment/columns';

describe('CSV 수식 막기', () => {
  it('수식으로 읽힐 수 있는 값 앞에 작은따옴표를 붙인다', () => {
    expect(neutralizeCsvFormula('=HYPERLINK("http://x")')).toBe('\'=HYPERLINK("http://x")');
    expect(neutralizeCsvFormula('+1+1')).toBe("'+1+1");
    expect(neutralizeCsvFormula('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(neutralizeCsvFormula('-2+3')).toBe("'-2+3");
  });

  it('평범한 값·음수·하이픈 하나는 그대로 둔다', () => {
    expect(neutralizeCsvFormula('검증용1')).toBe('검증용1');
    expect(neutralizeCsvFormula('-12')).toBe('-12');
    expect(neutralizeCsvFormula('-3.5')).toBe('-3.5');
    expect(neutralizeCsvFormula('-')).toBe('-');
    expect(neutralizeCsvFormula('.12.123')).toBe('.12.123');
  });

  it('가져올 때 붙였던 작은따옴표를 뗀다 (평범한 작은따옴표 값은 그대로)', () => {
    expect(restoreCsvFormula("'=1+1")).toBe('=1+1');
    expect(restoreCsvFormula("'안녕")).toBe("'안녕");
  });

  it('장비 CSV 로 내보냈다 다시 읽으면 원래 값이 된다', () => {
    const columns: EquipmentColumn[] = [{ id: 1, label: '장비', sort_order: 0 }, { id: 2, label: '비고', sort_order: 1 }];
    const rows = [{ '1': '검증용1', '2': '=CMD()' }];
    const csv = toCsv(columns, rows);
    expect(csv).toContain("'=CMD()");
    expect(fromCsv(parseCsvText(csv), columns)).toEqual(rows);
  });
});
