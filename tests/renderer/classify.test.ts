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

  it('Prioritizes Bugs over urgent when both are true', () => {
    expect(classifyGroup({ ...base, isBug: true, priority: 'urgent', labels: ['chore'] })).toBe(
      'Bugs',
    );
  });

  it('Chore when label "chore"', () => {
    expect(classifyGroup({ ...base, labels: ['chore'] })).toBe('Chore');
  });

  it('Chore when label is mixed-case', () => {
    expect(classifyGroup({ ...base, labels: ['ChOrE'] })).toBe('Chore');
  });

  it('Feature otherwise', () => {
    expect(classifyGroup(base)).toBe('Feature');
  });
});
