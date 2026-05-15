import { describe, expect, it, vi } from 'vitest';
import { streamTriageBrief } from '../../src/main/services/triage-generator';
import type { Issue } from '../../src/shared/types';

const issue: Issue = {
  id: 'FUL-77',
  title: 'x',
  description: 'y',
  status: 'triage',
  priority: 'medium',
  labels: [],
  url: '',
  updatedAt: '',
  isBug: false,
  assigneeId: null,
};

describe('streamTriageBrief', () => {
  it('calls streamClaude with --add-dir <computronRepoPath> and Read/Glob/Grep tools', async () => {
    const stream = vi.fn().mockResolvedValue('# brief');
    const chunks: string[] = [];

    const out = await streamTriageBrief({
      issue,
      computronRepoPath: '/tmp/computron',
      model: 'claude-sonnet-4-6',
      onChunk: (c) => chunks.push(c),
      streamClaude: stream,
    });

    expect(out).toBe('# brief');
    expect(stream).toHaveBeenCalledTimes(1);
    const arg = stream.mock.calls[0][0];
    expect(arg.model).toBe('claude-sonnet-4-6');
    expect(arg.extraArgs).toEqual([
      '--add-dir',
      '/tmp/computron',
      '--allowedTools',
      'Read,Glob,Grep',
    ]);
    expect(typeof arg.system).toBe('string');
    expect(arg.user).toContain('FUL-77');
  });
});
