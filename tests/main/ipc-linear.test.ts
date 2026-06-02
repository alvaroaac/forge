import { describe, it, expect, vi } from 'vitest';
import type { IpcMain } from 'electron';
import type { IpcChannelName } from '../../src/shared/ipc-channels';
import { IpcChannel } from '../../src/shared/ipc-channels';
import type { IssuesCache } from '../../src/main/services/issues-cache';
import type { Issue } from '../../src/shared/types';
import { registerLinearHandlers } from '../../src/main/ipc/linear';

type IpcMainHandler = (event: unknown, ...args: unknown[]) => Promise<unknown> | unknown;

type IpcMainLike = {
  handle: (channel: IpcChannelName, listener: IpcMainHandler) => void;
};

type IssuesCacheDouble = Pick<IssuesCache, 'read' | 'write'>;
type FetchIssues = (client: unknown) => Promise<Issue[]>;
type FetchIssueDetail = (client: unknown, issueId: string) => Promise<Issue | null>;
type FetchTriage = (client: unknown) => Promise<Issue[]>;
type GetViewerId = (client: unknown) => Promise<string>;

const baseIssue: Issue = {
  id: 'FUL-0',
  uuid: 'uuid-test-fixture',
  title: 'Base',
  description: 'desc',
  status: 'todo',
  priority: 'medium',
  labels: ['backend'],
  url: 'https://example.com/ful-0',
  updatedAt: '2026-01-01T00:00:00Z',
  isBug: false,
  assigneeId: null,
};

describe('registerLinearHandlers', () => {
  it('registers linear handlers on ipcMain', () => {
    const registrations: Array<{ channel: IpcChannelName; handler: IpcMainHandler }> = [];
    const ipc: IpcMainLike = {
      handle(channel, listener) {
        registrations.push({ channel, handler: listener });
      },
    };
    const cache: IssuesCacheDouble = {
      read: vi.fn(),
      write: vi.fn(),
    };
    const fetchIssues: FetchIssues = vi.fn();
    const fetchIssueDetail: FetchIssueDetail = vi.fn();
    const fetchTriage: FetchTriage = vi.fn();
    const getViewerId: GetViewerId = vi.fn();

    registerLinearHandlers(ipc as IpcMain, {
      cache,
      fetchIssues,
      fetchIssueDetail,
      fetchTriage,
      getViewerId,
      client: {},
    });

    expect(registrations).toHaveLength(5);
    expect(registrations.some((entry) => entry.channel === IpcChannel.LinearFetchIssues)).toBe(
      true,
    );
    expect(registrations.some((entry) => entry.channel === IpcChannel.LinearFetchIssueDetail)).toBe(
      true,
    );
    expect(registrations.some((entry) => entry.channel === IpcChannel.LinearFetchTeamTriage)).toBe(
      true,
    );
    expect(registrations.some((entry) => entry.channel === IpcChannel.LinearGetViewerId)).toBe(
      true,
    );
    expect(registrations.some((entry) => entry.channel === IpcChannel.LinearRefresh)).toBe(true);
    registrations.forEach((entry) => {
      expect(typeof entry.handler).toBe('function');
    });
  });

  it('linear:fetch-issues returns cache.read() and does not call fetchIssues', async () => {
    const calls = new Map<IpcChannelName, IpcMainHandler>();
    const cacheData = [{ ...baseIssue, id: 'FUL-1' }];
    const ipc: IpcMainLike = {
      handle(channel, listener) {
        calls.set(channel, listener);
      },
    };
    const cache: IssuesCacheDouble = {
      read: vi.fn().mockResolvedValue(cacheData),
      write: vi.fn(),
    };
    const fetchIssues: FetchIssues = vi
      .fn()
      .mockResolvedValue([
        { ...baseIssue, id: 'FUL-2', status: 'done', priority: 'high', assigneeId: null },
      ]);
    const fetchIssueDetail: FetchIssueDetail = vi.fn();
    const fetchTriage: FetchTriage = vi.fn();
    const getViewerId: GetViewerId = vi.fn();

    registerLinearHandlers(ipc as IpcMain, {
      cache,
      fetchIssues,
      fetchIssueDetail,
      fetchTriage,
      getViewerId,
      client: {},
    });
    const handler = calls.get(IpcChannel.LinearFetchIssues);
    expect(handler).toBeDefined();

    const result = await handler!({}, {});

    expect(result).toEqual(cacheData);
    expect(fetchIssues).not.toHaveBeenCalled();
    expect(cache.read).toHaveBeenCalledTimes(1);
    expect(cache.write).not.toHaveBeenCalled();
  });

  it('linear:refresh calls fetchIssues(client), writes returned issues to cache, then returns them', async () => {
    const calls = new Map<IpcChannelName, IpcMainHandler>();
    const client = {};
    const refreshed = [{ ...baseIssue, id: 'FUL-2', status: 'in_progress', priority: 'urgent' }];
    const ipc: IpcMainLike = {
      handle(channel, listener) {
        calls.set(channel, listener);
      },
    };
    const cache: IssuesCacheDouble = {
      read: vi.fn(),
      write: vi.fn(),
    };
    const fetchIssues: FetchIssues = vi.fn().mockResolvedValue(refreshed);
    const fetchIssueDetail: FetchIssueDetail = vi.fn();
    const fetchTriage: FetchTriage = vi.fn();
    const getViewerId: GetViewerId = vi.fn();

    registerLinearHandlers(ipc as IpcMain, {
      cache,
      fetchIssues,
      fetchIssueDetail,
      fetchTriage,
      getViewerId,
      client,
    });
    const handler = calls.get(IpcChannel.LinearRefresh);
    expect(handler).toBeDefined();

    const result = await handler!({}, {});

    expect(fetchIssues).toHaveBeenCalledTimes(1);
    expect(fetchIssues).toHaveBeenCalledWith(client);
    expect(cache.write).toHaveBeenCalledTimes(1);
    expect(cache.write).toHaveBeenCalledWith(refreshed);
    expect(result).toEqual(refreshed);
  });

  it('linear:fetch-issue-detail calls fetchIssueDetail(client, issueId)', async () => {
    const calls = new Map<IpcChannelName, IpcMainHandler>();
    const client = {};
    const issue = { ...baseIssue, id: 'FUL-3', status: 'in_review' };
    const ipc: IpcMainLike = {
      handle(channel, listener) {
        calls.set(channel, listener);
      },
    };
    const cache: IssuesCacheDouble = {
      read: vi.fn(),
      write: vi.fn(),
    };
    const fetchIssues: FetchIssues = vi.fn();
    const fetchIssueDetail: FetchIssueDetail = vi.fn().mockResolvedValue(issue);
    const fetchTriage: FetchTriage = vi.fn();
    const getViewerId: GetViewerId = vi.fn();

    registerLinearHandlers(ipc as IpcMain, {
      cache,
      fetchIssues,
      fetchIssueDetail,
      fetchTriage,
      getViewerId,
      client,
    });
    const handler = calls.get(IpcChannel.LinearFetchIssueDetail);
    expect(handler).toBeDefined();

    const result = await handler!({}, { issueId: 'FUL-3' });

    expect(fetchIssueDetail).toHaveBeenCalledTimes(1);
    expect(fetchIssueDetail).toHaveBeenCalledWith(client, 'FUL-3');
    expect(result).toEqual(issue);
  });

  it('linear:fetch-team-triage calls fetchTriage(client) once and returns issues', async () => {
    const calls = new Map<IpcChannelName, IpcMainHandler>();
    const client = {};
    const triage = [{ ...baseIssue, id: 'FUL-4', status: 'triage', assigneeId: 'u1' }];
    const ipc: IpcMainLike = {
      handle(channel, listener) {
        calls.set(channel, listener);
      },
    };
    const cache: IssuesCacheDouble = {
      read: vi.fn(),
      write: vi.fn(),
    };
    const fetchIssues: FetchIssues = vi.fn();
    const fetchIssueDetail: FetchIssueDetail = vi.fn();
    const fetchTriage: FetchTriage = vi.fn().mockResolvedValue(triage);
    const getViewerId: GetViewerId = vi.fn();

    registerLinearHandlers(ipc as IpcMain, {
      cache,
      fetchIssues,
      fetchIssueDetail,
      fetchTriage,
      getViewerId,
      client,
    });
    const handler = calls.get(IpcChannel.LinearFetchTeamTriage);
    expect(handler).toBeDefined();

    const result = await handler!({}, {});

    expect(fetchTriage).toHaveBeenCalledTimes(1);
    expect(fetchTriage).toHaveBeenCalledWith(client);
    expect(result).toEqual(triage);
  });

  it('linear:get-viewer-id caches viewer id from the first getViewerId(client) call', async () => {
    const calls = new Map<IpcChannelName, IpcMainHandler>();
    const client = {};
    const ipc: IpcMainLike = {
      handle(channel, listener) {
        calls.set(channel, listener);
      },
    };
    const cache: IssuesCacheDouble = {
      read: vi.fn(),
      write: vi.fn(),
    };
    const fetchIssues: FetchIssues = vi.fn();
    const fetchIssueDetail: FetchIssueDetail = vi.fn();
    const fetchTriage: FetchTriage = vi.fn();
    const getViewerId: GetViewerId = vi.fn().mockResolvedValue('viewer-1');

    registerLinearHandlers(ipc as IpcMain, {
      cache,
      fetchIssues,
      fetchIssueDetail,
      fetchTriage,
      getViewerId,
      client,
    });
    const handler = calls.get(IpcChannel.LinearGetViewerId);
    expect(handler).toBeDefined();

    const first = await handler!({}, {});
    const second = await handler!({}, {});

    expect(getViewerId).toHaveBeenCalledTimes(1);
    expect(first).toBe('viewer-1');
    expect(second).toBe('viewer-1');
  });
});
