/**
 * CSV 수식 삽입(CSV injection) 막기.
 *
 * CSV 를 엑셀로 열면 =, +, -, @ 로 시작하는 칸을 수식으로 실행한다.
 * 장비 현황표처럼 누구나 고칠 수 있는 칸에 "=HYPERLINK(...)" 같은 값이 들어가면
 * 내려받아 연 사람의 PC 에서 실행될 수 있다.
 * 내보낼 때는 앞에 작은따옴표를 붙여 글자로만 열리게 하고, 다시 가져올 때 떼어 낸다.
 */

const FORMULA_START = /^[=+\-@\t\r]/;
// 음수·날짜처럼 '-' 로 시작해도 수식이 아닌 흔한 값은 그대로 둔다 (예: -12, -3.5).
const PLAIN_NUMBER = /^-\d+(\.\d+)?$/;

export function neutralizeCsvFormula(text: string): string {
  if (!text || !FORMULA_START.test(text) || PLAIN_NUMBER.test(text)) return text;
  // '-' 한 글자처럼 수식이 될 수 없는 값은 건드리지 않는다.
  if (text.length === 1) return text;
  return `'${text}`;
}

export function restoreCsvFormula(text: string): string {
  if (text.length > 2 && text.startsWith("'") && FORMULA_START.test(text.slice(1))) return text.slice(1);
  return text;
}
