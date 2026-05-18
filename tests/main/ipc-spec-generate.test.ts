import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { IpcMain } from 'electron';
import { IpcChannel, type IpcChannelName } from '../../src/shared/ipc-channels';
import type { ConfigStore } from '../../src/main/services/config-store';
import type { IssuesCache } from '../../src/main/services/issues-cache';
import type { RepoContext } from '../../src/main/services/repo-reader';
import type { Issue, SpecStreamChunk } from '../../src/shared/types';
import { registerSpecGenerateHandler, registerSpecWriteHandler } from '../../src/main/ipc/spec';

type SpecGenerateDone = { issueId: string };
type SpecGenerateError = { issueId: string; message: string };
type SentPayload = SpecStreamChunk | SpecGenerateDone | SpecGenerateError;

type IpcMainHandler = (
  event: {
    sender: {
      send: (channel: IpcChannelName, payload: SentPayload) => void;
    };
  },
  payload: { issueId: string; model?: string },
) => Promise<unknown>;

type IpcMainLike = {
  handle: (channel: IpcChannelName, listener: IpcMainHandler) => void;
};

type ConfigStoreDouble = Pick<ConfigStore, 'get' | 'set'>;
type IssuesCacheDouble = Pick<IssuesCache, 'read' | 'write'>;

interface StreamSpecInput {
  model: string;
  system: string;
  user: string;
  extraArgs?: readonly string[];
  cwd?: string;
  onChunk: (delta: string) => void;
  onStatus?: (status: string) => void;
}

type StreamSpecDouble = (input: StreamSpecInput) => Promise<string>;
type PreflightClaudeRepoAccessDouble = (input: { repoPath: string }) => Promise<void>;

interface SpecDeps {
  store: ConfigStoreDouble;
  cache: IssuesCacheDouble;
  readRepoContext: (repoPath: string) => Promise<RepoContext>;
  streamSpec: StreamSpecDouble;
  preflightClaudeRepoAccess?: PreflightClaudeRepoAccessDouble;
  templateMd: string;
}

function createStore(repoPath: string, computronRepoPath = ''): ConfigStoreDouble {
  return {
    get: vi.fn().mockResolvedValue({
      linearTokenPath: '/tmp/linear-token.json',
      linearTeamKey: 'FUL',
      repoPath,
      computronRepoPath,
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
  assigneeId: null,
};

function isSpecChunk(payload: SentPayload): payload is SpecStreamChunk {
  return 'delta' in payload && 'done' in payload;
}

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

  it('streams deltas, emits chunk events, and returns the generated draft', async () => {
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
    const sent: Array<{ channel: IpcChannelName; payload: SentPayload }> = [];
    const streamSpec = vi.fn(async ({ onChunk, onStatus }: StreamSpecInput): Promise<string> => {
      onStatus?.('Claude initialized the repo session');
      onChunk('A');
      onChunk('B');
      return 'AB';
    });
    const handler = createHandler({
      store: createStore(dir),
      cache,
      readRepoContext,
      streamSpec,
      templateMd: 'TMPL',
    });
    const event = {
      sender: {
        send: (ch: IpcChannelName, payload: SentPayload) => {
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
        payload: {
          issueId: 'FUL-7',
          delta: '',
          done: false,
          status: 'Claude initialized the repo session',
        },
      },
      {
        channel: IpcChannel.SpecStreamChunk,
        payload: { issueId: 'FUL-7', delta: 'A', done: false, status: undefined },
      },
      {
        channel: IpcChannel.SpecStreamChunk,
        payload: { issueId: 'FUL-7', delta: 'B', done: false, status: undefined },
      },
      {
        channel: IpcChannel.SpecStreamChunk,
        payload: { issueId: 'FUL-7', delta: '', done: true, status: undefined },
      },
      { channel: IpcChannel.SpecGenerateDone, payload: { issueId: 'FUL-7' } },
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
  });

  it('uses the requested model override when provided', async () => {
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
    const readRepoContext = vi.fn().mockResolvedValue({ agentsMd: '', thoughts: [] });
    const streamSpec = vi.fn(async (): Promise<string> => 'content');
    const handler = createHandler({
      store: createStore(dir),
      cache,
      readRepoContext,
      streamSpec,
      templateMd: 'TMPL',
    });
    const event = { sender: { send: vi.fn() } };

    await handler(event, { issueId: 'FUL-7', model: 'opus' });

    const streamSpecInput = (streamSpec.mock.calls as unknown as Array<[StreamSpecInput]>)[0]?.[0];
    expect(streamSpecInput).toMatchObject({ model: 'opus' });
  });

  it('uses computron repo context, preflights access, and mounts computron for spec generation', async () => {
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
    const readRepoContext = vi.fn().mockResolvedValue({
      agentsMd: 'COMPUTRON-AGENTS',
      thoughts: [],
    });
    const preflightClaudeRepoAccess = vi.fn(async (): Promise<void> => undefined);
    const streamSpec = vi.fn(async (): Promise<string> => '# Spec');
    const handler = createHandler({
      store: createStore(dir, '/tmp/computron'),
      cache,
      readRepoContext,
      streamSpec,
      preflightClaudeRepoAccess,
      templateMd: 'TMPL',
    });
    const event = { sender: { send: vi.fn() } };

    await handler(event, { issueId: 'FUL-7', model: 'opus' });

    expect(readRepoContext).toHaveBeenCalledWith('/tmp/computron');
    expect(preflightClaudeRepoAccess).toHaveBeenCalledWith({
      repoPath: '/tmp/computron',
    });
    expect(streamSpec).toHaveBeenCalledWith(
      expect.objectContaining({
        extraArgs: ['--add-dir', '/tmp/computron', '--allowedTools', 'Read,Glob,Grep'],
        cwd: '/tmp/computron',
        user: expect.stringContaining('COMPUTRON-AGENTS'),
      }),
    );
  });

  it('surfaces preflight failures before starting the full spec stream', async () => {
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
    const readRepoContext = vi.fn().mockResolvedValue({ agentsMd: '', thoughts: [] });
    const preflightClaudeRepoAccess = vi.fn(async (): Promise<void> => {
      throw new Error('permissions pending');
    });
    const streamSpec = vi.fn(async (): Promise<string> => 'ignored');
    const handler = createHandler({
      store: createStore(dir, '/tmp/computron'),
      cache,
      readRepoContext,
      streamSpec,
      preflightClaudeRepoAccess,
      templateMd: 'TMPL',
    });
    const event = { sender: { send: vi.fn() } };

    await expect(handler(event, { issueId: 'FUL-7' })).rejects.toThrow('permissions pending');

    expect(streamSpec).not.toHaveBeenCalled();
    expect(event.sender.send).toHaveBeenCalledWith(IpcChannel.SpecGenerateError, {
      issueId: 'FUL-7',
      message: 'permissions pending',
    });
  });

  it('throws when issue is not in cache', async () => {
    const cache: IssuesCacheDouble = {
      read: vi.fn().mockResolvedValue([]),
      write: vi.fn(),
    };
    const readRepoContext = vi.fn().mockResolvedValue({ agentsMd: '', thoughts: [] });
    const streamSpec = vi.fn(async (): Promise<string> => 'ignored');

    const handler = createHandler({
      store: createStore(dir),
      cache,
      readRepoContext,
      streamSpec,
      templateMd: 'TMPL',
    });
    const event = { sender: { send: vi.fn() } };

    await expect(handler(event, { issueId: 'NOPE' })).rejects.toThrow(
      'Issue not found in cache: NOPE',
    );
    expect(streamSpec).not.toHaveBeenCalled();
    expect(readRepoContext).not.toHaveBeenCalled();
    expect(event.sender.send).toHaveBeenCalledWith(IpcChannel.SpecGenerateError, {
      issueId: 'NOPE',
      message: 'Issue not found in cache: NOPE',
    });
  });

  it('rejects unsafe issueIds before spec work', async () => {
    const issue: Issue = { id: '../outside', ...issueTemplate, title: 'Bad', description: 'desc' };
    const cache: IssuesCacheDouble = {
      read: vi.fn().mockResolvedValue([issue]),
      write: vi.fn(),
    };
    const readRepoContext = vi.fn().mockResolvedValue({ agentsMd: '', thoughts: [] });
    const streamSpec = vi.fn(async (): Promise<string> => 'ignored');

    const handler = createHandler({
      store: createStore(dir),
      cache,
      readRepoContext,
      streamSpec,
      templateMd: 'TMPL',
    });
    const event = { sender: { send: vi.fn() } };

    await expect(handler(event, { issueId: '../outside' })).rejects.toThrow(
      'Issue not found in cache: ../outside',
    );
    expect(readRepoContext).not.toHaveBeenCalled();
    expect(streamSpec).not.toHaveBeenCalled();
    expect(event.sender.send).toHaveBeenCalledWith(IpcChannel.SpecGenerateError, {
      issueId: '../outside',
      message: 'Issue not found in cache: ../outside',
    });
  });

  it('emits done chunk after the stream resolves', async () => {
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
    const readRepoContext = vi.fn().mockResolvedValue({ agentsMd: '', thoughts: [] });
    const sent: Array<{ channel: IpcChannelName; payload: SentPayload }> = [];
    const streamSpec = vi.fn(async ({ onChunk }: StreamSpecInput): Promise<string> => {
      onChunk('A');
      return 'A';
    });
    const send = vi.fn((channel: IpcChannelName, payload: SentPayload) => {
      sent.push({ channel, payload });
    });
    const handler = createHandler({
      store: createStore(dir),
      cache,
      readRepoContext,
      streamSpec,
      templateMd: 'TMPL',
    });
    const event = {
      sender: {
        send,
      },
    };

    await handler(event, { issueId: 'FUL-7' });

    const doneChunkCallIndex = send.mock.calls.findIndex(
      ([channel, payload]) =>
        channel === IpcChannel.SpecStreamChunk && isSpecChunk(payload) && payload.done,
    );
    expect(doneChunkCallIndex).toBeGreaterThan(-1);
  });
});

describe('spec:write', () => {
  it('writes cleaned markdown to the spec file', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'spec-write-'));
    const writeSpec = vi
      .fn()
      .mockResolvedValue(join(dir, 'thoughts', 'tasks', 'FUL-7', 'initial-spec.md'));
    const callRegistry = new Map<IpcChannelName, unknown>();
    const ipc = {
      handle(channel: IpcChannelName, listener: unknown) {
        callRegistry.set(channel, listener);
      },
    };

    registerSpecWriteHandler(ipc as IpcMain, {
      store: createStore(dir),
      writeSpec,
    });

    const handler = callRegistry.get(IpcChannel.SpecWrite) as (
      event: unknown,
      payload: { issueId: string; content: string },
    ) => Promise<{ issueId: string; content: string }>;
    const result = await handler(null, {
      issueId: 'FUL-7',
      content: 'Permission needed\n\n```markdown\n# Spec: FUL-7\n\n## Task Summary\nBody\n```',
    });

    expect(result).toEqual({ issueId: 'FUL-7', content: '# Spec: FUL-7\n\n## Task Summary\nBody' });
    expect(writeSpec).toHaveBeenCalledWith({
      repoPath: dir,
      issueId: 'FUL-7',
      content: '# Spec: FUL-7\n\n## Task Summary\nBody',
    });
  });

  it('rejects unsafe issue ids before writing', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'spec-write-'));
    const writeSpec = vi.fn();
    const callRegistry = new Map<IpcChannelName, unknown>();
    const ipc = {
      handle(channel: IpcChannelName, listener: unknown) {
        callRegistry.set(channel, listener);
      },
    };

    registerSpecWriteHandler(ipc as IpcMain, {
      store: createStore(dir),
      writeSpec,
    });

    const handler = callRegistry.get(IpcChannel.SpecWrite) as (
      event: unknown,
      payload: { issueId: string; content: string },
    ) => Promise<unknown>;

    await expect(handler(null, { issueId: '../outside', content: '# Spec' })).rejects.toThrow(
      'Unsafe issue id: ../outside',
    );
    expect(writeSpec).not.toHaveBeenCalled();
  });
});
