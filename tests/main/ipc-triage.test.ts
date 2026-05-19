import { describe, it, expect, vi } from 'vitest';
import { mkdtempSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  registerTriageGenerateHandler,
  registerTriageGetHandler,
  registerTriageWriteHandler,
} from '../../src/main/ipc/triage';
import { IpcChannel } from '../../src/shared/ipc-channels';
import type { Issue } from '../../src/shared/types';

function fakeIpc() {
  const handlers = new Map<string, (event: unknown, payload: unknown) => unknown>();
  return {
    handle: (channel: string, fn: (event: unknown, payload: unknown) => unknown) => {
      handlers.set(channel, fn);
    },
    invoke: (channel: string, event: unknown, payload: unknown) => {
      const fn = handlers.get(channel);
      if (!fn) {
        throw new Error(`no handler for ${channel}`);
      }
      return fn(event, payload);
    },
  };
}

function fakeEvent() {
  const sent: Array<{ channel: string; payload: unknown }> = [];
  return {
    sender: {
      send: (channel: string, payload: unknown) => {
        sent.push({ channel, payload });
      },
    },
    sent,
  };
}

const triageIssue: Issue = {
  id: 'FUL-77',
  title: 't',
  description: 'd',
  status: 'triage',
  priority: 'medium',
  labels: [],
  url: '',
  updatedAt: '',
  isBug: false,
  assigneeId: null,
};

describe('triage:get handler', () => {
  it('returns a persisted triage brief when triage-brief.md exists', async () => {
    const repoPath = mkdtempSync(join(tmpdir(), 'triage-get-'));
    const taskDir = join(repoPath, 'thoughts', 'tasks', 'FUL-77');
    mkdirSync(taskDir, { recursive: true });
    const filePath = join(taskDir, 'triage-brief.md');
    writeFileSync(filePath, '# saved brief', 'utf-8');
    const expectedGeneratedAt = statSync(filePath).mtime.toISOString();
    const ipc = fakeIpc();

    registerTriageGetHandler(ipc as never, {
      store: {
        get: async () => ({
          linearTokenPath: '',
          linearTeamKey: 'FUL',
          repoPath,
          computronRepoPath: '',
          claudeModel: '',
        }),
        set: async () => undefined,
      } as never,
    });

    await expect(ipc.invoke(IpcChannel.TriageGet, {}, { issueId: 'FUL-77' })).resolves.toEqual({
      issueId: 'FUL-77',
      content: '# saved brief',
      generatedAt: expectedGeneratedAt,
    });
  });

  it('returns null when triage-brief.md is missing or issue id is unsafe', async () => {
    const repoPath = mkdtempSync(join(tmpdir(), 'triage-get-'));
    const ipc = fakeIpc();

    registerTriageGetHandler(ipc as never, {
      store: {
        get: async () => ({
          linearTokenPath: '',
          linearTeamKey: 'FUL',
          repoPath,
          computronRepoPath: '',
          claudeModel: '',
        }),
        set: async () => undefined,
      } as never,
    });

    await expect(ipc.invoke(IpcChannel.TriageGet, {}, { issueId: 'FUL-77' })).resolves.toBeNull();
    await expect(
      ipc.invoke(IpcChannel.TriageGet, {}, { issueId: '../FUL-77' }),
    ).resolves.toBeNull();
  });
});

describe('triage:generate handler', () => {
  it('streams chunks then a done event and returns the full content', async () => {
    const ipc = fakeIpc();
    const event = fakeEvent();

    registerTriageGenerateHandler(ipc as never, {
      store: {
        get: async () => ({
          linearTokenPath: '',
          linearTeamKey: 'FUL',
          repoPath: '',
          computronRepoPath: '/tmp/computron',
          claudeModel: 'claude-sonnet-4-6',
        }),
        set: async () => undefined,
      } as never,
      fetchTriageList: async () => [triageIssue],
      streamTriageBrief: async ({ onChunk, onStatus }) => {
        onStatus?.('Claude initialized the repo session');
        onStatus?.('Claude is drafting the spec');
        onChunk('part 1 ');
        onChunk('part 2');
        return 'part 1 part 2';
      },
    });

    const result = await ipc.invoke(IpcChannel.TriageGenerate, event, {
      issueId: 'FUL-77',
      model: 'claude-sonnet-4-6',
    });

    expect(result).toEqual({ issueId: 'FUL-77', content: 'part 1 part 2' });
    const chunkSends = event.sent.filter((s) => s.channel === IpcChannel.TriageStreamChunk);
    expect(chunkSends).toHaveLength(5);
    expect(chunkSends[0].payload).toMatchObject({
      issueId: 'FUL-77',
      delta: '',
      done: false,
      status: 'Claude initialized the repo session',
    });
    expect(chunkSends[1].payload).toMatchObject({
      issueId: 'FUL-77',
      delta: '',
      done: false,
      status: 'Claude is drafting the brief',
    });
    expect(chunkSends[4].payload).toMatchObject({ issueId: 'FUL-77', delta: '', done: true });
    expect(event.sent.some((s) => s.channel === IpcChannel.TriageGenerateDone)).toBe(true);
  });

  it('emits an error event when computronRepoPath is empty', async () => {
    const ipc = fakeIpc();
    const event = fakeEvent();

    registerTriageGenerateHandler(ipc as never, {
      store: {
        get: async () => ({
          linearTokenPath: '',
          linearTeamKey: 'FUL',
          repoPath: '',
          computronRepoPath: '',
          claudeModel: 'claude-sonnet-4-6',
        }),
        set: async () => undefined,
      } as never,
      fetchTriageList: async () => [triageIssue],
      streamTriageBrief: vi.fn(),
    });

    await expect(
      ipc.invoke(IpcChannel.TriageGenerate, event, { issueId: 'FUL-77' }),
    ).rejects.toThrow(/computronRepoPath/);
    expect(event.sent.some((s) => s.channel === IpcChannel.TriageGenerateError)).toBe(true);
  });
});

describe('triage:write handler', () => {
  it('passes through to writeTriageBrief in create mode by default', async () => {
    const ipc = fakeIpc();
    const writeTriageBrief = vi.fn().mockResolvedValue({
      path: '/tmp/forge/thoughts/tasks/FUL-77/triage-brief.md',
      written: true,
      exists: false,
    });

    registerTriageWriteHandler(ipc as never, {
      store: {
        get: async () => ({
          linearTokenPath: '',
          linearTeamKey: 'FUL',
          repoPath: '/tmp/forge',
          computronRepoPath: '',
          claudeModel: '',
        }),
        set: async () => undefined,
      } as never,
      writeTriageBrief,
    });

    const result = await ipc.invoke(
      IpcChannel.TriageWrite,
      {},
      {
        issueId: 'FUL-77',
        content: '# brief',
      },
    );

    expect(writeTriageBrief).toHaveBeenCalledWith({
      repoPath: '/tmp/forge',
      issueId: 'FUL-77',
      content: '# brief',
      mode: 'create',
    });
    expect(result).toEqual({
      issueId: 'FUL-77',
      path: '/tmp/forge/thoughts/tasks/FUL-77/triage-brief.md',
      written: true,
      exists: false,
    });
  });

  it('uses overwrite mode when payload.overwrite=true', async () => {
    const ipc = fakeIpc();
    const writeTriageBrief = vi.fn().mockResolvedValue({
      path: '/tmp/forge/thoughts/tasks/FUL-77/triage-brief.md',
      written: true,
      exists: true,
    });

    registerTriageWriteHandler(ipc as never, {
      store: {
        get: async () => ({
          linearTokenPath: '',
          linearTeamKey: 'FUL',
          repoPath: '/tmp/forge',
          computronRepoPath: '',
          claudeModel: '',
        }),
        set: async () => undefined,
      } as never,
      writeTriageBrief,
    });

    await ipc.invoke(
      IpcChannel.TriageWrite,
      {},
      {
        issueId: 'FUL-77',
        content: '# brief',
        overwrite: true,
      },
    );

    expect(writeTriageBrief).toHaveBeenCalledWith(expect.objectContaining({ mode: 'overwrite' }));
  });
});
