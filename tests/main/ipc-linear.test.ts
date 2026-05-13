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

    registerLinearHandlers(ipc as IpcMain, { cache, fetchIssues, client: {} });

    expect(registrations).toHaveLength(2);
    expect(registrations.some((entry) => entry.channel === IpcChannel.LinearFetchIssues)).toBe(
      true,
    );
    expect(registrations.some((entry) => entry.channel === IpcChannel.LinearRefresh)).toBe(true);
    registrations.forEach((entry) => {
      expect(typeof entry.handler).toBe('function');
    });
  });

  it('linear:fetch-issues returns cache.read() and does not call fetchIssues', async () => {
    const calls = new Map<IpcChannelName, IpcMainHandler>();
    const cacheData: Issue[] = [
      {
        id: 'FUL-1',
        title: 'One',
        description: 'desc',
        status: 'todo',
        priority: 'medium',
        labels: ['backend'],
        url: 'https://example.com/ful-1',
        updatedAt: '2026-01-01T00:00:00Z',
        isBug: false,
      },
    ];
    const ipc: IpcMainLike = {
      handle(channel, listener) {
        calls.set(channel, listener);
      },
    };
    const cache: IssuesCacheDouble = {
      read: vi.fn().mockResolvedValue(cacheData),
      write: vi.fn(),
    };
    const fetchIssues: FetchIssues = vi.fn().mockResolvedValue([
      {
        id: 'FUL-2',
        title: 'Two',
        description: 'fresh',
        status: 'done',
        priority: 'high',
        labels: ['frontend'],
        url: 'https://example.com/ful-2',
        updatedAt: '2026-01-02T00:00:00Z',
        isBug: true,
      },
    ]);

    registerLinearHandlers(ipc as IpcMain, { cache, fetchIssues, client: {} });
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
    const refreshed: Issue[] = [
      {
        id: 'FUL-2',
        title: 'Two',
        description: 'fresh',
        status: 'in_progress',
        priority: 'urgent',
        labels: ['frontend'],
        url: 'https://example.com/ful-2',
        updatedAt: '2026-01-02T00:00:00Z',
        isBug: true,
      },
    ];
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

    registerLinearHandlers(ipc as IpcMain, { cache, fetchIssues, client });
    const handler = calls.get(IpcChannel.LinearRefresh);
    expect(handler).toBeDefined();

    const result = await handler!({}, {});

    expect(fetchIssues).toHaveBeenCalledTimes(1);
    expect(fetchIssues).toHaveBeenCalledWith(client);
    expect(cache.write).toHaveBeenCalledTimes(1);
    expect(cache.write).toHaveBeenCalledWith(refreshed);
    expect(result).toEqual(refreshed);
  });
});
