export const MAX_DATE_VALUE = '9999-12-31';

export function clampDateYear(value: string): string {
  if (!value) return value;

  const [year, ...rest] = value.split('-');
  if (!/^\d{5,}$/.test(year)) return value;

  return [year.slice(0, 4), ...rest].join('-');
}
