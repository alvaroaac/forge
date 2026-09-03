import { describe, expect, it, vi } from 'vitest';
import { streamBrief } from '../../src/main/services/brief-generator';
import type { Issue } from '../../src/shared/types';

const issue: Issue = {
  id: 'FUL-77',
  uuid: 'uuid-test-fixture',
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

describe('streamBrief', () => {
  it('calls streamClaude with --add-dir <computronRepoPath> and Read/Glob/Grep tools', async () => {
    const stream = vi.fn().mockResolvedValue('# brief');
    const chunks: string[] = [];
    const onStatus = vi.fn();

    const out = await streamBrief({
      issue,
      computronRepoPath: '/tmp/computron',
      model: 'claude-sonnet-4-6',
      onChunk: (c) => chunks.push(c),
      onStatus,
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
    expect(arg.cwd).toBe('/tmp/computron');
    expect(arg.onStatus).toBe(onStatus);
    expect(typeof arg.system).toBe('string');
    expect(arg.user).toContain('FUL-77');
  });
});

describe('streamBrief — curatedComments passthrough', () => {
  it('forwards curatedComments to streamClaude when provided', async () => {
    const calls: Array<{ user: string; curatedComments?: string }> = [];
    await streamBrief({
      issue,
      computronRepoPath: '/tmp/cmp',
      model: 'claude-sonnet-4-6',
      curatedComments: '## Relevant Comments\n_(none)_',
      onChunk: () => undefined,
      streamClaude: async (input) => {
        calls.push({ user: input.user, curatedComments: input.curatedComments });
        return 'ok';
      },
    });
    expect(calls[0].curatedComments).toBe('## Relevant Comments\n_(none)_');
  });

  it('omits curatedComments when not provided', async () => {
    const calls: Array<{ curatedComments?: string }> = [];
    await streamBrief({
      issue,
      computronRepoPath: '/tmp/cmp',
      model: 'claude-sonnet-4-6',
      onChunk: () => undefined,
      streamClaude: async (input) => {
        calls.push({ curatedComments: input.curatedComments });
        return 'ok';
      },
    });
    expect(calls[0].curatedComments).toBeUndefined();
  });
});
