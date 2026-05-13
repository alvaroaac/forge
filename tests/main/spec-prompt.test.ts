import { describe, it, expect } from 'vitest';
import { buildSpecPrompt } from '../../src/main/services/spec-prompt';
import type { Issue } from '../../src/shared/types';

const issue: Issue = {
  id: 'FUL-7',
  title: 'fix thing',
  description: 'broken',
  status: 'todo',
  priority: 'high',
  labels: ['bug'],
  url: 'u',
  updatedAt: '',
  isBug: true,
};

describe('buildSpecPrompt', () => {
  it('returns system+user with all context included', () => {
    const p = buildSpecPrompt({
      issue,
      context: { agentsMd: 'AM', thoughts: [{ name: 'conventions.md', content: 'C' }] },
      templateMd: 'TEMPLATE',
    });
    expect(p.system).toMatch(/senior engineer/i);
    expect(p.user).toContain('AM');
    expect(p.user).toContain('conventions.md');
    expect(p.user).toContain('C');
    expect(p.user).toContain('FUL-7');
    expect(p.user).toContain('fix thing');
    expect(p.user).toContain('broken');
    expect(p.user).toContain('TEMPLATE');
  });
});
