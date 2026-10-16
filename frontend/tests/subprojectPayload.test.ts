import { describe, expect, it } from 'vitest';
import { buildSubProjectPayload } from '../app/components/TeamModal/payload';
import { EMPTY_FORM } from '../app/components/TeamModal/types';

describe('buildSubProjectPayload (B-100)', () => {
  it('담당자를 비우면 빈 문자열 대신 null 을 보낸다', () => {
    const payload = buildSubProjectPayload({ ...EMPTY_FORM, projectId: 1, name: 'x' });
    expect(payload.assignee_id).toBeNull();
    expect(payload.assignee_ids).toEqual([]);
  });

  it('담당자가 있으면 첫 사람을 대표 담당자로 보낸다', () => {
    const payload = buildSubProjectPayload({ ...EMPTY_FORM, projectId: 1, name: 'x', assigneeIds: [7, 8] });
    expect(payload.assignee_id).toBe(7);
  });
});
