import { describe, it, expect } from 'vitest';
import { buildTriagePrompt } from '../../src/main/services/triage-prompt';
import type { Issue } from '../../src/shared/types';

describe('buildTriagePrompt', () => {
  const issue: Issue = {
    id: 'FUL-77',
    uuid: 'uuid-test-fixture',
    title: 'job runner stuck',
    description: 'It stops at 30%',
    status: 'triage',
    priority: 'high',
    labels: ['support'],
    url: 'https://example.com/ful-77',
    updatedAt: '',
    isBug: true,
    assigneeId: null,
  };

  it('builds system and user prompts for triage brief', () => {
    const prompt = buildTriagePrompt({ issue });

    const expectedOrder = [
      '**What the user likely wants**',
      '**Likely affected components**',
      '**Open questions for reporter**',
      '**Suggested next step**',
    ];

    const system = prompt.system;
    const sectionIndexes = expectedOrder.map((heading) => system.indexOf(heading));
    for (const heading of expectedOrder) {
      expect(system).toContain(heading);
    }
    for (const idx of sectionIndexes) {
      expect(idx).toBeGreaterThan(-1);
    }
    for (let i = 1; i < sectionIndexes.length; i += 1) {
      expect(sectionIndexes[i]).toBeGreaterThan(sectionIndexes[i - 1]);
    }

    expect(system).toContain('1-3 sentences, plain language');
    expect(system).toContain('bullet list of file paths or modules in');
    expect(system).toContain('the computron repo, one-line reason each');
    expect(system).toContain('one of: "Needs reproduction", "Needs spec"');
    expect(system).toContain('"Probable duplicate of <X>"');
    expect(system).toContain('"Ready for spec", or "Out of scope"');
    expect(system).toMatch(/plus one\s+sentence why/);
    expect(system).toContain('recommendation');
    expect(system).toContain('soft');
    expect(system).toContain('hard limit');
    expect(system).toContain('aim for roughly 6 tool calls');
    expect(prompt.system).toContain('--add-dir');
    expect(prompt.system).toContain('Glob');
    expect(prompt.system).toContain('Grep');
    expect(prompt.system).toContain('Read');
    expect(prompt.system).toContain('roughly 6 tool calls');

    expect(prompt.user).toContain('FUL-77');
    expect(prompt.user).toContain('job runner stuck');
    expect(prompt.user).toContain('high');
    expect(prompt.user).toContain('support');
    expect(prompt.user).toContain('It stops at 30%');
    expect(prompt.user).toContain('cwd is the computron repo root');
  });
});
