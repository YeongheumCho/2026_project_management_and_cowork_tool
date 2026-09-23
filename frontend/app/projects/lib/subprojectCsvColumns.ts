/**
 * CSV 내보내기·가져오기가 함께 쓰는 열 이름 정의.
 *
 * 내보낸 파일을 그대로 다시 가져올 수 있어야 한다는 것이 이 파일의 목적이다.
 * 예전에는 내보내기가 `평균 예상 소요(분)` 로 쓰는데 가져오기는 그 이름을 몰라서,
 * 이름을 못 찾으면 자리 번호로 엉뚱한 열을 읽고 모든 줄에 오류를 냈다.
 *
 * 이제 가져오기는 여기 있는 별칭으로만 열을 찾는다.
 * 내보내기 열 이름이 항상 별칭에 포함되므로 왕복이 보장된다.
 * 열 이름을 바꾸려면 이 파일만 고치면 된다.
 */

/** 공백과 대소문자를 무시하고 비교하기 위한 정규화 */
export function normalizeHeader(value: string): string {
  return value.replace(/^﻿/, '').replace(/\s+/g, '').toLowerCase();
}

/** 내보내기가 쓰는 열 이름. 순서가 곧 CSV 열 순서다. */
export const EXPORT_HEADERS = [
  '대프로젝트',
  '프로젝트',
  '프로젝트 유형',
  '하위 프로젝트',
  '담당자',
  '시작일',
  '종료일',
  '상태',
  '진행률(%)',
  '우선순위',
  '제어기명',
  '버전 정보',
  '국가',
  'TO 번호',
  'TO 담당자',
  '검증 LEVEL',
  '차종',
  '기능명',
  '기능 담당자 ID',
  '검증 담당자',
  '리뷰 담당자',
  '검증 자리',
  '제어기 번호',
  '평균 예상 소요(분)',
  '가중치',
  '업로드 완료',
  '완료일',
  '1차 검증 상태',
  '1차 Setup(분)',
  '1차 AUD(분)',
  '1차 Review(분)',
  'InReview 상태',
  'InReview Setup(분)',
  'InReview AUD(분)',
  'InReview 반영(분)',
  'CR 번호',
  'IP 주소',
  '변경점 Feedback(분)',
  '변경점 재검증(분)',
  'LIN/STd 대기 사유',
  '기타 구분',
  '기타 월',
  '기타 일수',
  '기타 메모',
  '특이사항',
  '이슈 메모',
  '사용자 지정 항목',
] as const;

/**
 * 가져오기가 찾는 열과 그 별칭.
 *
 * 각 항목의 첫 번째 값은 내보내기가 쓰는 이름이다.
 * 뒤의 것들은 손으로 만든 파일이나 예전 양식을 위한 여유다.
 */
export const IMPORT_COLUMNS = {
  /** 하위 프로젝트 이름. 기능명이 비어 있을 때 이 값을 대신 쓴다. */
  subprojectName: ['하위 프로젝트', '하위프로젝트명', '소프로젝트', 'subproject', 'subproject_name'],
  functionName: ['기능명', '검증기능', '검증 기능', 'function_name', 'function', 'name'],
  minutes: [
    '평균 예상 소요(분)',
    '평균예상소요',
    '평균소요시간(분)',
    '평균 소요 시간(분)',
    '평균소요시간',
    '평균 소요 시간',
    '평균소요',
    'avg_expected_minutes',
    'minutes',
  ],
  assignee: ['담당자', '담당자명', 'assignee', 'assignee_name'],
  weight: ['가중치', 'weight'],
  level: [
    '검증 LEVEL',
    'Lv',
    'LV',
    'level',
    '검증Lv',
    '검증LV',
    '검증Level',
    'verification_level',
  ],
} as const;

export type ImportColumnKey = keyof typeof IMPORT_COLUMNS;

/** 사람이 읽을 열 이름 (오류 안내에 쓴다) */
export const IMPORT_COLUMN_LABEL: Record<ImportColumnKey, string> = {
  subprojectName: '하위 프로젝트',
  functionName: '기능명',
  minutes: '평균 예상 소요(분)',
  assignee: '담당자',
  weight: '가중치',
  level: '검증 LEVEL',
};

/** 헤더 줄에서 해당 열의 위치를 찾는다. 못 찾으면 -1. */
export function findColumn(headers: string[], key: ImportColumnKey): number {
  const aliases = IMPORT_COLUMNS[key].map(normalizeHeader);
  return headers.findIndex((header) => aliases.includes(normalizeHeader(header)));
}

/**
 * 가져오기에 반드시 있어야 하는 열이 빠졌는지 확인한다.
 *
 * 이름 열 하나만 필수다. 소요 시간·담당자·Lv 는 나중에 채울 수 있으므로
 * 열이 없어도 등록을 막지 않는다.
 * 자리 번호로 넘겨짚지는 않는다. 엉뚱한 열을 읽고 "숫자로 입력하세요" 같은
 * 엉뚱한 오류를 내느니, 어떤 열이 없는지 분명히 알려주는 편이 낫다.
 */
export function missingRequiredColumns(headers: string[]): string[] {
  // 이름은 기능명이나 하위 프로젝트 중 하나만 있으면 된다
  if (findColumn(headers, 'functionName') < 0 && findColumn(headers, 'subprojectName') < 0) {
    return [`${IMPORT_COLUMN_LABEL.functionName} 또는 ${IMPORT_COLUMN_LABEL.subprojectName}`];
  }
  return [];
}
