import { describe, it, expect, vi } from 'vitest';
import { mkdtempSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  registerBriefGenerateHandler,
  registerBriefGetHandler,
  registerBriefWriteHandler,
} from '../../src/main/ipc/brief';
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

const baseBriefCfg = {
  linearTokenPath: '',
  linearTeamKey: 'FUL',
  repoPath: '',
  computronRepoPath: '/tmp/computron',
  claudeModel: 'claude-sonnet-4-6',
};

describe('brief:get handler', () => {
  it('returns a persisted brief when brief.md exists', async () => {
    const repoPath = mkdtempSync(join(tmpdir(), 'brief-get-'));
    const taskDir = join(repoPath, 'thoughts', 'tasks', 'FUL-77');
    mkdirSync(taskDir, { recursive: true });
    const filePath = join(taskDir, 'brief.md');
    writeFileSync(filePath, '# saved brief', 'utf-8');
    const expectedGeneratedAt = statSync(filePath).mtime.toISOString();
    const ipc = fakeIpc();

    registerBriefGetHandler(ipc as never, {
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

    await expect(ipc.invoke(IpcChannel.BriefGet, {}, { issueId: 'FUL-77' })).resolves.toEqual({
      issueId: 'FUL-77',
      content: '# saved brief',
      generatedAt: expectedGeneratedAt,
    });
  });

  it('returns null when brief.md is missing or issue id is unsafe', async () => {
    const repoPath = mkdtempSync(join(tmpdir(), 'brief-get-'));
    const ipc = fakeIpc();

    registerBriefGetHandler(ipc as never, {
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

    await expect(ipc.invoke(IpcChannel.BriefGet, {}, { issueId: 'FUL-77' })).resolves.toBeNull();
    await expect(
      ipc.invoke(IpcChannel.BriefGet, {}, { issueId: '../FUL-77' }),
    ).resolves.toBeNull();
  });
});

describe('brief:generate handler', () => {
  it('streams chunks then a done event and returns the full content', async () => {
    const ipc = fakeIpc();
    const event = fakeEvent();

    registerBriefGenerateHandler(ipc as never, {
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
      streamBrief: async ({ onChunk, onStatus }) => {
        onStatus?.('Claude initialized the repo session');
        onStatus?.('Claude is drafting the spec');
        onChunk('part 1 ');
        onChunk('part 2');
        return 'part 1 part 2';
      },
    });

    const result = await ipc.invoke(IpcChannel.BriefGenerate, event, {
      issueId: 'FUL-77',
      model: 'claude-sonnet-4-6',
    });

    expect(result).toEqual({ issueId: 'FUL-77', content: 'part 1 part 2' });
    const chunkSends = event.sent.filter((s) => s.channel === IpcChannel.BriefStreamChunk);
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
    expect(event.sent.some((s) => s.channel === IpcChannel.BriefGenerateDone)).toBe(true);
  });

  it('notifies when brief generation succeeds', async () => {
    const ipc = fakeIpc();
    const event = fakeEvent();
    const notifyDone = vi.fn();

    registerBriefGenerateHandler(ipc as never, {
      store: {
        get: async () => baseBriefCfg,
        set: async () => undefined,
      } as never,
      fetchTriageList: async () => [triageIssue],
      fetchAndFilterComments: async () => [],
      triageComments: async () => '',
      streamBrief: async () => 'brief',
      notifyDone,
    });

    await ipc.invoke(IpcChannel.BriefGenerate, event, { issueId: 'FUL-77' });

    expect(notifyDone).toHaveBeenCalledWith('Brief ready', 'FUL-77 finished generating.');
  });

  it('does not send a success notification when brief generation fails', async () => {
    const ipc = fakeIpc();
    const event = fakeEvent();
    const notifyDone = vi.fn();

    registerBriefGenerateHandler(ipc as never, {
      store: {
        get: async () => baseBriefCfg,
        set: async () => undefined,
      } as never,
      fetchTriageList: async () => [triageIssue],
      fetchAndFilterComments: async () => [],
      triageComments: async () => '',
      streamBrief: async () => {
        throw new Error('Claude failed');
      },
      notifyDone,
    });

    await expect(
      ipc.invoke(IpcChannel.BriefGenerate, event, { issueId: 'FUL-77' }),
    ).rejects.toThrow('Claude failed');

    expect(notifyDone).not.toHaveBeenCalled();
  });

  it('does not fail generation when the success notification throws', async () => {
    const ipc = fakeIpc();
    const event = fakeEvent();
    const notifyDone = vi.fn(() => {
      throw new Error('Notification failed');
    });

    registerBriefGenerateHandler(ipc as never, {
      store: {
        get: async () => baseBriefCfg,
        set: async () => undefined,
      } as never,
      fetchTriageList: async () => [triageIssue],
      fetchAndFilterComments: async () => [],
      triageComments: async () => '',
      streamBrief: async () => 'brief',
      notifyDone,
    });

    await expect(
      ipc.invoke(IpcChannel.BriefGenerate, event, { issueId: 'FUL-77' }),
    ).resolves.toEqual({ issueId: 'FUL-77', content: 'brief' });

    expect(event.sent.filter((s) => s.channel === IpcChannel.BriefGenerateError)).toHaveLength(0);
  });

  it('emits an error event when computronRepoPath is empty', async () => {
    const ipc = fakeIpc();
    const event = fakeEvent();

    registerBriefGenerateHandler(ipc as never, {
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
      streamBrief: vi.fn(),
    });

    await expect(
      ipc.invoke(IpcChannel.BriefGenerate, event, { issueId: 'FUL-77' }),
    ).rejects.toThrow(/computronRepoPath/);
    expect(event.sent.some((s) => s.channel === IpcChannel.BriefGenerateError)).toBe(true);
  });
});

describe('brief:generate handler - comment-context pipeline', () => {
  it('emits triaging then generating phase events with commentCount', async () => {
    const ipc = fakeIpc();
    const event = fakeEvent();

    registerBriefGenerateHandler(ipc as never, {
      store: { get: async () => baseBriefCfg, set: async () => undefined } as never,
      fetchTriageList: async () => [triageIssue],
      fetchAndFilterComments: async () => [sampleComment],
      triageComments: async () => 'CURATED',
      streamBrief: async ({ curatedComments, onChunk }) => {
        expect(curatedComments).toBe('CURATED');
        onChunk('part');
        return 'part';
      },
    });

    await ipc.invoke(IpcChannel.BriefGenerate, event, { issueId: 'FUL-77' });

    const phaseEvents = event.sent.filter((s) => s.channel === IpcChannel.BriefPhase);
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

    registerBriefGenerateHandler(ipc as never, {
      store: { get: async () => baseBriefCfg, set: async () => undefined } as never,
      fetchTriageList: async () => [triageIssue],
      fetchAndFilterComments: async () => [sampleComment],
      triageComments: async () => {
        throw new Error('boom');
      },
      streamBrief: async ({ curatedComments, onChunk }) => {
        observed = curatedComments;
        onChunk('still');
        return 'still';
      },
    });

    const result = await ipc.invoke(IpcChannel.BriefGenerate, event, { issueId: 'FUL-77' });

    expect(observed).toBe('');
    const errors = event.sent.filter((s) => s.channel === IpcChannel.BriefGenerateError);
    expect(errors).toHaveLength(0);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[brief] comment context failed'),
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

    registerBriefGenerateHandler(ipc as never, {
      store: { get: async () => baseBriefCfg, set: async () => undefined } as never,
      fetchTriageList: async () => [triageIssue],
      fetchAndFilterComments: async () => {
        throw new Error('linear unavailable');
      },
      triageComments: triage,
      streamBrief: async ({ curatedComments, onChunk }) => {
        observed = curatedComments;
        onChunk('still');
        return 'still';
      },
    });

    const result = await ipc.invoke(IpcChannel.BriefGenerate, event, { issueId: 'FUL-77' });

    expect(observed).toBe('');
    expect(triage).not.toHaveBeenCalled();
    const errors = event.sent.filter((s) => s.channel === IpcChannel.BriefGenerateError);
    expect(errors).toHaveLength(0);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[brief] comment context failed'),
      expect.any(Error),
    );
    expect(result).toMatchObject({ issueId: 'FUL-77', content: 'still' });
    warnSpy.mockRestore();
  });

  it('emits triaging with commentCount 0 without calling the comment triager', async () => {
    const ipc = fakeIpc();
    const event = fakeEvent();
    const triage = vi.fn();

    registerBriefGenerateHandler(ipc as never, {
      store: { get: async () => baseBriefCfg, set: async () => undefined } as never,
      fetchTriageList: async () => [triageIssue],
      fetchAndFilterComments: async () => [],
      triageComments: triage,
      streamBrief: async ({ curatedComments, onChunk }) => {
        expect(curatedComments).toBe('');
        onChunk('done');
        return 'done';
      },
    });

    await ipc.invoke(IpcChannel.BriefGenerate, event, { issueId: 'FUL-77' });

    expect(triage).not.toHaveBeenCalled();
    const phaseEvents = event.sent.filter((s) => s.channel === IpcChannel.BriefPhase);
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

    registerBriefGenerateHandler(ipc as never, {
      store: { get: async () => baseBriefCfg, set: async () => undefined } as never,
      fetchTriageList: async () => [triageIssue],
      fetchAndFilterComments: fetchSpy,
      triageComments: async () => '',
      streamBrief: async () => '',
    });

    await ipc.invoke(IpcChannel.BriefGenerate, event, { issueId: triageIssue.id });

    expect(fetchSpy).toHaveBeenCalledWith(triageIssue.uuid);
  });

  it('skips comment fetch and still generates when a stale cached issue has no UUID', async () => {
    const ipc = fakeIpc();
    const event = fakeEvent();
    const fetchSpy = vi.fn().mockResolvedValue([sampleComment]);
    const triage = vi.fn().mockResolvedValue('CURATED');
    const staleIssue: Issue = { ...triageIssue, uuid: undefined as unknown as string };

    registerBriefGenerateHandler(ipc as never, {
      store: { get: async () => baseBriefCfg, set: async () => undefined } as never,
      fetchTriageList: async () => [staleIssue],
      fetchAndFilterComments: fetchSpy,
      triageComments: triage,
      streamBrief: async ({ curatedComments, onChunk }) => {
        expect(curatedComments).toBe('');
        onChunk('generated');
        return 'generated';
      },
    });

    const result = await ipc.invoke(IpcChannel.BriefGenerate, event, { issueId: staleIssue.id });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(triage).not.toHaveBeenCalled();
    expect(event.sent.filter((s) => s.channel === IpcChannel.BriefGenerateError)).toHaveLength(0);
    expect(event.sent.filter((s) => s.channel === IpcChannel.BriefPhase)).toEqual([
      { channel: IpcChannel.BriefPhase, payload: { issueId: 'FUL-77', phase: 'generating' } },
    ]);
    expect(result).toMatchObject({ issueId: 'FUL-77', content: 'generated' });
  });
});

describe('brief:write handler', () => {
  it('passes through to writeBrief in create mode by default', async () => {
    const ipc = fakeIpc();
    const writeBrief = vi.fn().mockResolvedValue({
      path: '/tmp/forge/thoughts/tasks/FUL-77/brief.md',
      written: true,
      exists: false,
    });

    registerBriefWriteHandler(ipc as never, {
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
      writeBrief,
    });

    const result = await ipc.invoke(
      IpcChannel.BriefWrite,
      {},
      {
        issueId: 'FUL-77',
        content: '# brief',
      },
    );

    expect(writeBrief).toHaveBeenCalledWith({
      repoPath: '/tmp/forge',
      issueId: 'FUL-77',
      content: '# brief',
      mode: 'create',
    });
    expect(result).toEqual({
      issueId: 'FUL-77',
      path: '/tmp/forge/thoughts/tasks/FUL-77/brief.md',
      written: true,
      exists: false,
    });
  });

  it('uses overwrite mode when payload.overwrite=true', async () => {
    const ipc = fakeIpc();
    const writeBrief = vi.fn().mockResolvedValue({
      path: '/tmp/forge/thoughts/tasks/FUL-77/brief.md',
      written: true,
      exists: true,
    });

    registerBriefWriteHandler(ipc as never, {
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
      writeBrief,
    });

    await ipc.invoke(
      IpcChannel.BriefWrite,
      {},
      {
        issueId: 'FUL-77',
        content: '# brief',
        overwrite: true,
      },
    );

    expect(writeBrief).toHaveBeenCalledWith(expect.objectContaining({ mode: 'overwrite' }));
  });
});
