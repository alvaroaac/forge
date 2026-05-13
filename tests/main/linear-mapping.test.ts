import { describe, it, expect } from 'vitest';
import { mapPriority } from '../../src/main/services/linear-mapping';

describe('mapPriority', () => {
  it('maps Linear numeric priorities', () => {
    expect(mapPriority(1)).toBe('urgent');
    expect(mapPriority(2)).toBe('high');
    expect(mapPriority(3)).toBe('medium');
    expect(mapPriority(4)).toBe('low');
    expect(mapPriority(0)).toBe('none');
  });
  it('falls back to none for unexpected', () => {
    expect(mapPriority(99)).toBe('none');
  });
});
