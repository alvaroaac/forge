import { describe, it, expect, vi } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { IpcMain } from 'electron';
import type { ConfigStore } from '../../src/main/services/config-store';
import { IpcChannel, type IpcChannelName } from '../../src/shared/ipc-channels';
import { registerConfigHandlers } from '../../src/main/ipc/config';
import { createConfigStore } from '../../src/main/services/config-store';

type IpcMainHandler = (event: unknown, ...args: unknown[]) => Promise<unknown> | unknown;
type IpcMainLike = {
  handle: (channel: IpcChannelName, listener: IpcMainHandler) => void;
};

type ConfigStoreDouble = Pick<ConfigStore, 'get' | 'set'>;

describe('registerConfigHandlers', () => {
  it('registers config:get + config:set on ipcMain', () => {
    const registrations: Array<{ channel: IpcChannelName; handler: IpcMainHandler }> = [];
    const ipc: IpcMainLike = {
      handle(channel, listener) {
        registrations.push({ channel, handler: listener });
      },
    };
    const store: ConfigStoreDouble = {
      get: vi.fn(),
      set: vi.fn(),
    };

    registerConfigHandlers(ipc as IpcMain, store);

    expect(registrations).toHaveLength(2);
    expect(registrations.some((entry) => entry.channel === IpcChannel.ConfigGet)).toBe(true);
    expect(registrations.some((entry) => entry.channel === IpcChannel.ConfigSet)).toBe(true);
    registrations.forEach((entry) => {
      expect(typeof entry.handler).toBe('function');
    });
  });

  it('config:get returns store.get()', async () => {
    const calls = new Map<IpcChannelName, IpcMainHandler>();
    const ipc: IpcMainLike = {
      handle(channel, listener) {
        calls.set(channel, listener);
      },
    };
    const expected = {
      linearTokenPath: '/tmp/linear.json',
      linearTeamKey: 'FUL',
      repoPath: '/tmp/repo',
      claudeModel: 'claude-sonnet-4-6',
    };
    const store: ConfigStoreDouble = {
      get: vi.fn().mockResolvedValue(expected),
      set: vi.fn(),
    };

    registerConfigHandlers(ipc as IpcMain, store);
    const handler = calls.get(IpcChannel.ConfigGet);
    expect(handler).toBeDefined();

    const result = await handler!({}, []);
    expect(result).toEqual(expected);
    expect(store.get).toHaveBeenCalledTimes(1);
  });

  it('exposes computronRepoPath default as empty string', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'forge-cfg-'));
    const store = createConfigStore(join(dir, 'config.json'));
    const cfg = await store.get();
    expect(cfg.computronRepoPath).toBe('');
  });
});
