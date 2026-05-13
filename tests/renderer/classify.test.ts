import { describe, expect, it } from 'vitest';

import { classifyGroup } from '../../src/renderer/lib/classify';
import type { Issue } from '../../src/shared/types';

const base: Issue = {
  id: 'F-1',
  title: 't',
  description: '',
  status: 'todo',
  priority: 'medium',
  labels: [],
  url: '',
  updatedAt: '',
  isBug: false,
};

describe('classifyGroup', () => {
  it('Bugs when isBug', () => {
    expect(classifyGroup({ ...base, isBug: true })).toBe('Bugs');
  });

  it('Urgent when priority urgent and not bug', () => {
    expect(classifyGroup({ ...base, priority: 'urgent' })).toBe('Urgent');
  });

  it('Chore when label "chore"', () => {
    expect(classifyGroup({ ...base, labels: ['chore'] })).toBe('Chore');
  });

  it('Feature otherwise', () => {
    expect(classifyGroup(base)).toBe('Feature');
  });
});
