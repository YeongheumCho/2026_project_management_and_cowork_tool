/**
 * 인원 선택 목록에 보여줄 사람을 고른다.
 *
 * 퇴사(비활성) 인원은 숨긴다. 백엔드가 새로 넣는 것을 거부하기 때문이다.
 * 예전에는 목록에는 보이는데 저장하면 "유효하지 않은 참여자"로 막혀서,
 * 재직 중인 인턴을 넣으려다 실패한 것처럼 보였다.
 *
 * 단 이미 들어 있던 사람(keepIds)은 퇴사했어도 남긴다.
 * 그래야 기존 참여자가 화면에서 사라지지 않고, 필요하면 직접 뺄 수 있다.
 */
export function selectableMembers<T extends { id: number; is_active?: boolean | null }>(
  users: T[],
  keepIds: Iterable<number> = [],
): T[] {
  const keep = new Set(keepIds);
  return users.filter((user) => user.is_active !== false || keep.has(user.id));
}
