import { describe, it, expect } from 'vitest';
import { buildTriagePrompt } from '../../src/main/services/triage-prompt';
import type { Issue } from '../../src/shared/types';

describe('buildTriagePrompt', () => {
  const issue: Issue = {
    id: 'FUL-77',
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

    expect(prompt.system).toMatch(/What the user likely wants/);
    expect(prompt.system).toMatch(/Likely affected components/);
    expect(prompt.system).toMatch(/Open questions for reporter/);
    expect(prompt.system).toMatch(/Suggested next step/);
    expect(prompt.system).toContain('--add-dir');
    expect(prompt.system).toContain('Glob');
    expect(prompt.system).toContain('Grep');
    expect(prompt.system).toContain('Read');

    expect(prompt.user).toContain('FUL-77');
    expect(prompt.user).toContain('job runner stuck');
    expect(prompt.user).toContain('high');
    expect(prompt.user).toContain('support');
    expect(prompt.user).toContain('It stops at 30%');
    expect(prompt.user).toContain('cwd is the computron repo root');
  });
});
