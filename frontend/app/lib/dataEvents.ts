const DATA_CHANGED_EVENT = 'kpi:data-changed';

/** 데이터를 바꾸는 API 호출이 성공했을 때 발행. 사이드바처럼 자체 fetch 를 가진 UI 가 다시 불러오는 신호. */
export function notifyDataChanged() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(DATA_CHANGED_EVENT));
}

export function subscribeDataChanged(listener: () => void) {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(DATA_CHANGED_EVENT, listener);
  return () => window.removeEventListener(DATA_CHANGED_EVENT, listener);
}
