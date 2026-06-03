import { describe, it, expect, vi } from 'vitest';
import { mkdtempSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  registerTriageGenerateHandler,
  registerTriageGetHandler,
  registerTriageWriteHandler,
} from '../../src/main/ipc/triage';
import type { LinearComment } from '../../src/main/services/comment-fetcher';
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
  uuid: 'uuid-test-fixture',
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

const sampleComment: LinearComment = {
  id: 'c-1',
  body: 'hi',
  createdAt: '2026-05-01T00:00:00.000Z',
  authorName: 'Alice',
  isBot: false,
};

const baseTriageCfg = {
  linearTokenPath: '',
  linearTeamKey: 'FUL',
  repoPath: '',
  computronRepoPath: '/tmp/computron',
  claudeModel: 'claude-sonnet-4-6',
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
      fetchAndFilterComments: async () => [],
      triageComments: async () => '',
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

  it('notifies when brief generation succeeds', async () => {
    const ipc = fakeIpc();
    const event = fakeEvent();
    const notifyDone = vi.fn();

    registerTriageGenerateHandler(ipc as never, {
      store: {
        get: async () => baseTriageCfg,
        set: async () => undefined,
      } as never,
      fetchTriageList: async () => [triageIssue],
      fetchAndFilterComments: async () => [],
      triageComments: async () => '',
      streamTriageBrief: async () => 'brief',
      notifyDone,
    });

    await ipc.invoke(IpcChannel.TriageGenerate, event, { issueId: 'FUL-77' });

    expect(notifyDone).toHaveBeenCalledWith('Brief ready', 'FUL-77 finished generating.');
  });

  it('does not send a success notification when brief generation fails', async () => {
    const ipc = fakeIpc();
    const event = fakeEvent();
    const notifyDone = vi.fn();

    registerTriageGenerateHandler(ipc as never, {
      store: {
        get: async () => baseTriageCfg,
        set: async () => undefined,
      } as never,
      fetchTriageList: async () => [triageIssue],
      fetchAndFilterComments: async () => [],
      triageComments: async () => '',
      streamTriageBrief: async () => {
        throw new Error('Claude failed');
      },
      notifyDone,
    });

    await expect(
      ipc.invoke(IpcChannel.TriageGenerate, event, { issueId: 'FUL-77' }),
    ).rejects.toThrow('Claude failed');

    expect(notifyDone).not.toHaveBeenCalled();
  });

  it('does not fail generation when the success notification throws', async () => {
    const ipc = fakeIpc();
    const event = fakeEvent();
    const notifyDone = vi.fn(() => {
      throw new Error('Notification failed');
    });

    registerTriageGenerateHandler(ipc as never, {
      store: {
        get: async () => baseTriageCfg,
        set: async () => undefined,
      } as never,
      fetchTriageList: async () => [triageIssue],
      fetchAndFilterComments: async () => [],
      triageComments: async () => '',
      streamTriageBrief: async () => 'brief',
      notifyDone,
    });

    await expect(
      ipc.invoke(IpcChannel.TriageGenerate, event, { issueId: 'FUL-77' }),
    ).resolves.toEqual({ issueId: 'FUL-77', content: 'brief' });

    expect(event.sent.filter((s) => s.channel === IpcChannel.TriageGenerateError)).toHaveLength(0);
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
      fetchAndFilterComments: async () => [],
      triageComments: async () => '',
      streamTriageBrief: vi.fn(),
    });

    await expect(
      ipc.invoke(IpcChannel.TriageGenerate, event, { issueId: 'FUL-77' }),
    ).rejects.toThrow(/computronRepoPath/);
    expect(event.sent.some((s) => s.channel === IpcChannel.TriageGenerateError)).toBe(true);
  });
});

describe('triage:generate handler - comment-context pipeline', () => {
  it('emits triaging then generating phase events with commentCount', async () => {
    const ipc = fakeIpc();
    const event = fakeEvent();

    registerTriageGenerateHandler(ipc as never, {
      store: { get: async () => baseTriageCfg, set: async () => undefined } as never,
      fetchTriageList: async () => [triageIssue],
      fetchAndFilterComments: async () => [sampleComment],
      triageComments: async () => 'CURATED',
      streamTriageBrief: async ({ curatedComments, onChunk }) => {
        expect(curatedComments).toBe('CURATED');
        onChunk('part');
        return 'part';
      },
    });

    await ipc.invoke(IpcChannel.TriageGenerate, event, { issueId: 'FUL-77' });

    const phaseEvents = event.sent.filter((s) => s.channel === IpcChannel.TriagePhase);
    expect(phaseEvents).toHaveLength(2);
    expect(phaseEvents[0].payload).toEqual({
      issueId: 'FUL-77',
      phase: 'triaging',
      commentCount: 1,
    });
    expect(phaseEvents[1].payload).toEqual({ issueId: 'FUL-77', phase: 'generating' });
  });

  it('proceeds with empty curated when triage fails - logs warn, no error event', async () => {
    const ipc = fakeIpc();
    const event = fakeEvent();
    let observed: string | undefined;
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    registerTriageGenerateHandler(ipc as never, {
      store: { get: async () => baseTriageCfg, set: async () => undefined } as never,
      fetchTriageList: async () => [triageIssue],
      fetchAndFilterComments: async () => [sampleComment],
      triageComments: async () => {
        throw new Error('boom');
      },
      streamTriageBrief: async ({ curatedComments, onChunk }) => {
        observed = curatedComments;
        onChunk('still');
        return 'still';
      },
    });

    const result = await ipc.invoke(IpcChannel.TriageGenerate, event, { issueId: 'FUL-77' });

    expect(observed).toBe('');
    const errors = event.sent.filter((s) => s.channel === IpcChannel.TriageGenerateError);
    expect(errors).toHaveLength(0);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[triage] comment context failed'),
      expect.any(Error),
    );
    expect(result).toMatchObject({ issueId: 'FUL-77' });
    warnSpy.mockRestore();
  });

  it('proceeds with empty curated when comment fetch fails - logs warn, no error event', async () => {
    const ipc = fakeIpc();
    const event = fakeEvent();
    let observed: string | undefined;
    const triage = vi.fn().mockResolvedValue('CURATED');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    registerTriageGenerateHandler(ipc as never, {
      store: { get: async () => baseTriageCfg, set: async () => undefined } as never,
      fetchTriageList: async () => [triageIssue],
      fetchAndFilterComments: async () => {
        throw new Error('linear unavailable');
      },
      triageComments: triage,
      streamTriageBrief: async ({ curatedComments, onChunk }) => {
        observed = curatedComments;
        onChunk('still');
        return 'still';
      },
    });

    const result = await ipc.invoke(IpcChannel.TriageGenerate, event, { issueId: 'FUL-77' });

    expect(observed).toBe('');
    expect(triage).not.toHaveBeenCalled();
    const errors = event.sent.filter((s) => s.channel === IpcChannel.TriageGenerateError);
    expect(errors).toHaveLength(0);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[triage] comment context failed'),
      expect.any(Error),
    );
    expect(result).toMatchObject({ issueId: 'FUL-77', content: 'still' });
    warnSpy.mockRestore();
  });

  it('emits triaging with commentCount 0 without calling the comment triager', async () => {
    const ipc = fakeIpc();
    const event = fakeEvent();
    const triage = vi.fn();

    registerTriageGenerateHandler(ipc as never, {
      store: { get: async () => baseTriageCfg, set: async () => undefined } as never,
      fetchTriageList: async () => [triageIssue],
      fetchAndFilterComments: async () => [],
      triageComments: triage,
      streamTriageBrief: async ({ curatedComments, onChunk }) => {
        expect(curatedComments).toBe('');
        onChunk('done');
        return 'done';
      },
    });

    await ipc.invoke(IpcChannel.TriageGenerate, event, { issueId: 'FUL-77' });

    expect(triage).not.toHaveBeenCalled();
    const phaseEvents = event.sent.filter((s) => s.channel === IpcChannel.TriagePhase);
    expect(phaseEvents).toHaveLength(2);
    expect(phaseEvents[0].payload).toEqual({
      issueId: 'FUL-77',
      phase: 'triaging',
      commentCount: 0,
    });
    expect(phaseEvents[1].payload).toEqual({ issueId: 'FUL-77', phase: 'generating' });
  });

  it('invokes fetchAndFilterComments with the issue UUID', async () => {
    const ipc = fakeIpc();
    const event = fakeEvent();
    const fetchSpy = vi.fn().mockResolvedValue([]);

    registerTriageGenerateHandler(ipc as never, {
      store: { get: async () => baseTriageCfg, set: async () => undefined } as never,
      fetchTriageList: async () => [triageIssue],
      fetchAndFilterComments: fetchSpy,
      triageComments: async () => '',
      streamTriageBrief: async () => '',
    });

    await ipc.invoke(IpcChannel.TriageGenerate, event, { issueId: triageIssue.id });

    expect(fetchSpy).toHaveBeenCalledWith(triageIssue.uuid);
  });

  it('skips comment fetch and still generates when a stale cached issue has no UUID', async () => {
    const ipc = fakeIpc();
    const event = fakeEvent();
    const fetchSpy = vi.fn().mockResolvedValue([sampleComment]);
    const triage = vi.fn().mockResolvedValue('CURATED');
    const staleIssue: Issue = { ...triageIssue, uuid: undefined as unknown as string };

    registerTriageGenerateHandler(ipc as never, {
      store: { get: async () => baseTriageCfg, set: async () => undefined } as never,
      fetchTriageList: async () => [staleIssue],
      fetchAndFilterComments: fetchSpy,
      triageComments: triage,
      streamTriageBrief: async ({ curatedComments, onChunk }) => {
        expect(curatedComments).toBe('');
        onChunk('generated');
        return 'generated';
      },
    });

    const result = await ipc.invoke(IpcChannel.TriageGenerate, event, { issueId: staleIssue.id });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(triage).not.toHaveBeenCalled();
    expect(event.sent.filter((s) => s.channel === IpcChannel.TriageGenerateError)).toHaveLength(0);
    expect(event.sent.filter((s) => s.channel === IpcChannel.TriagePhase)).toEqual([
      { channel: IpcChannel.TriagePhase, payload: { issueId: 'FUL-77', phase: 'generating' } },
    ]);
    expect(result).toMatchObject({ issueId: 'FUL-77', content: 'generated' });
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
