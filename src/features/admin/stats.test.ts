import { describe, expect, it } from 'vitest';
import { brazilDateKey } from './stats';
describe('Brazilian operations dates',()=>{
  it('matches SQL day buckets before and after midnight in Sao Paulo',()=>{
    expect(brazilDateKey(new Date('2026-10-09T02:59:59Z'))).toBe('2026-10-08');
    expect(brazilDateKey(new Date('2026-10-09T03:00:00Z'))).toBe('2026-10-09');
    expect(brazilDateKey(new Date('2026-10-10T01:00:00Z'))).toBe('2026-10-09');
  });
});
