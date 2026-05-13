import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type Anthropic from '@anthropic-ai/sdk';
import type { IpcMain } from 'electron';
import { IpcChannel, type IpcChannelName } from '../../src/shared/ipc-channels';
import type { ConfigStore } from '../../src/main/services/config-store';
import type { IssuesCache } from '../../src/main/services/issues-cache';
import type { RepoContext } from '../../src/main/services/repo-reader';
import type { Issue, SpecStreamChunk } from '../../src/shared/types';
import { registerSpecGenerateHandler } from '../../src/main/ipc/spec';

type IpcMainHandler = (
  event: {
    sender: {
      send: (channel: IpcChannelName, payload: SpecStreamChunk) => void;
    };
  },
  payload: { issueId: string },
) => Promise<unknown>;

type IpcMainLike = {
  handle: (channel: IpcChannelName, listener: IpcMainHandler) => void;
};

type ConfigStoreDouble = Pick<ConfigStore, 'get' | 'set'>;
type IssuesCacheDouble = Pick<IssuesCache, 'read' | 'write'>;

interface StreamSpecInput {
  client: Anthropic;
  model: string;
  system: string;
  user: string;
  onChunk: (delta: string) => void;
}

type StreamSpecDouble = (input: StreamSpecInput) => Promise<string>;

interface SpecDeps {
  store: ConfigStoreDouble;
  cache: IssuesCacheDouble;
  readRepoContext: (repoPath: string) => Promise<RepoContext>;
  streamSpec: StreamSpecDouble;
  writeSpec: (opts: { repoPath: string; issueId: string; content: string }) => Promise<string>;
  anthropic: Anthropic;
  templateMd: string;
}

function createStore(repoPath: string): ConfigStoreDouble {
  return {
    get: vi.fn().mockResolvedValue({
      linearTokenPath: '/tmp/linear-token.json',
      linearTeamKey: 'FUL',
      repoPath,
      claudeModel: 'claude-sonnet-4-6',
    }),
    set: vi.fn(),
  };
}

const issueTemplate: Omit<Issue, 'id' | 'title' | 'description'> = {
  status: 'todo',
  priority: 'high',
  labels: ['frontend'],
  isBug: false,
  url: 'https://example.com',
  updatedAt: '2026-01-01T00:00:00Z',
};

describe('spec:generate', () => {
  let dir: string;
  let callRegistry: Map<IpcChannelName, IpcMainHandler>;

  const createHandler = (deps: SpecDeps): IpcMainHandler => {
    callRegistry = new Map();
    const ipc: IpcMainLike = {
      handle(channel, listener) {
        callRegistry.set(channel, listener);
      },
    };
    registerSpecGenerateHandler(ipc as IpcMain, deps);
    const handler = callRegistry.get(IpcChannel.SpecGenerate);
    expect(handler).toBeDefined();
    return handler!;
  };

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'spec-gen-'));
    callRegistry = new Map();
  });

  it('streams deltas, emits chunk events, and writes final spec', async () => {
    const issue: Issue = {
      id: 'FUL-7',
      title: 'Build UI',
      description: 'Add streaming spec preview.',
      ...issueTemplate,
    };
    const cache: IssuesCacheDouble = {
      read: vi.fn().mockResolvedValue([issue]),
      write: vi.fn(),
    };
    const readRepoContext = vi.fn(
      async (): Promise<RepoContext> => ({
        agentsMd: 'AGENTS-MD',
        thoughts: [{ name: 'conventions.md', content: 'convention notes' }],
      }),
    );
    const sent: Array<{ channel: IpcChannelName; payload: SpecStreamChunk }> = [];
    const streamSpec = vi.fn(async ({ onChunk }: StreamSpecInput): Promise<string> => {
      onChunk('A');
      onChunk('B');
      return 'AB';
    });
    const writeSpec = vi
      .fn()
      .mockResolvedValue(join(dir, 'thoughts', 'tasks', 'FUL-7', 'initial-spec.md'));
    const handler = createHandler({
      store: createStore(dir),
      cache,
      readRepoContext,
      streamSpec,
      writeSpec,
      anthropic: {} as Anthropic,
      templateMd: 'TMPL',
    });
    const event = {
      sender: {
        send: (ch: IpcChannelName, payload: SpecStreamChunk) => {
          sent.push({ channel: ch, payload });
        },
      },
    };

    const result = (await handler(event, { issueId: 'FUL-7' })) as {
      issueId: string;
      content: string;
    };

    expect(result).toEqual({ issueId: 'FUL-7', content: 'AB' });
    expect(sent).toEqual([
      {
        channel: IpcChannel.SpecStreamChunk,
        payload: { issueId: 'FUL-7', delta: 'A', done: false },
      },
      {
        channel: IpcChannel.SpecStreamChunk,
        payload: { issueId: 'FUL-7', delta: 'B', done: false },
      },
      { channel: IpcChannel.SpecStreamChunk, payload: { issueId: 'FUL-7', delta: '', done: true } },
    ]);
    expect(readRepoContext).toHaveBeenCalledWith(dir);
    expect(streamSpec).toHaveBeenCalledTimes(1);
    expect(streamSpec.mock.calls[0]?.[0]).toMatchObject({
      model: 'claude-sonnet-4-6',
      system: expect.stringContaining('senior engineer'),
      user: expect.stringContaining('AGENTS-MD'),
    });
    const user = streamSpec.mock.calls[0]?.[0].user;
    expect(user).toContain('FUL-7');
    expect(user).toContain('Build UI');
    expect(user).toContain('TMPL');
    expect(writeSpec).toHaveBeenCalledWith({ repoPath: dir, issueId: 'FUL-7', content: 'AB' });
  });

  it('throws when issue is not in cache', async () => {
    const cache: IssuesCacheDouble = {
      read: vi.fn().mockResolvedValue([]),
      write: vi.fn(),
    };
    const readRepoContext = vi.fn().mockResolvedValue({ agentsMd: '', thoughts: [] });
    const streamSpec = vi.fn(async (): Promise<string> => 'ignored');
    const writeSpec = vi.fn();

    const handler = createHandler({
      store: createStore(dir),
      cache,
      readRepoContext,
      streamSpec,
      writeSpec,
      anthropic: {} as Anthropic,
      templateMd: 'TMPL',
    });
    const event = { sender: { send: vi.fn() } };

    await expect(handler(event, { issueId: 'NOPE' })).rejects.toThrow(
      'Issue not found in cache: NOPE',
    );
    expect(streamSpec).not.toHaveBeenCalled();
    expect(readRepoContext).not.toHaveBeenCalled();
    expect(writeSpec).not.toHaveBeenCalled();
  });

  it('rejects unsafe issueIds before spec work', async () => {
    const issue: Issue = { id: '../outside', ...issueTemplate, title: 'Bad', description: 'desc' };
    const cache: IssuesCacheDouble = {
      read: vi.fn().mockResolvedValue([issue]),
      write: vi.fn(),
    };
    const readRepoContext = vi.fn().mockResolvedValue({ agentsMd: '', thoughts: [] });
    const streamSpec = vi.fn(async (): Promise<string> => 'ignored');
    const writeSpec = vi.fn();

    const handler = createHandler({
      store: createStore(dir),
      cache,
      readRepoContext,
      streamSpec,
      writeSpec,
      anthropic: {} as Anthropic,
      templateMd: 'TMPL',
    });
    const event = { sender: { send: vi.fn() } };

    await expect(handler(event, { issueId: '../outside' })).rejects.toThrow(
      'Issue not found in cache: ../outside',
    );
    expect(readRepoContext).not.toHaveBeenCalled();
    expect(streamSpec).not.toHaveBeenCalled();
    expect(writeSpec).not.toHaveBeenCalled();
  });
});
