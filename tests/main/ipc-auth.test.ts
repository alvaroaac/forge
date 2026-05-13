import { describe, it, expect, vi } from 'vitest';
import type { IpcMain } from 'electron';
import type { ConfigStore } from '../../src/main/services/config-store';
import type { AuthStatus, AppConfig } from '../../src/shared/types';
import { IpcChannel, type IpcChannelName } from '../../src/shared/ipc-channels';
import { registerAuthHandlers } from '../../src/main/ipc/auth';

type IpcMainHandler = (event: unknown, ...args: unknown[]) => Promise<unknown> | unknown;
type IpcMainLike = {
  handle: (channel: IpcChannelName, listener: IpcMainHandler) => void;
};

type ConfigStoreDouble = Pick<ConfigStore, 'get' | 'set'>;
type CheckAllFn = (params: { linearTokenPath: string }) => Promise<AuthStatus>;

describe('registerAuthHandlers', () => {
  it('registers auth:check on ipcMain', () => {
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
    const checkAll: CheckAllFn = vi.fn();

    registerAuthHandlers(ipc as IpcMain, store, checkAll);

    expect(registrations).toHaveLength(1);
    expect(registrations[0]?.channel).toBe(IpcChannel.AuthCheck);
    expect(typeof registrations[0]?.handler).toBe('function');
  });

  it('auth:check returns AuthStatus from checkAll with cfg.linearTokenPath', async () => {
    const registered = new Map<IpcChannelName, IpcMainHandler>();
    const ipc: IpcMainLike = {
      handle(channel, listener) {
        registered.set(channel, listener);
      },
    };
    const cfg: AppConfig = {
      linearTokenPath: '/tmp/linear-token.json',
      linearTeamKey: 'FUL',
      repoPath: '/tmp/repo',
      claudeModel: 'claude-sonnet-4-6',
    };
    const status: AuthStatus = { linear: true, claudeCode: false, codex: true };
    const store: ConfigStoreDouble = {
      get: vi.fn().mockResolvedValue(cfg),
      set: vi.fn(),
    };
    const checkAll: CheckAllFn = vi.fn().mockResolvedValue(status);

    registerAuthHandlers(ipc as IpcMain, store, checkAll);
    const handler = registered.get(IpcChannel.AuthCheck);
    expect(handler).toBeDefined();

    const result = await handler!({}, []);

    expect(store.get).toHaveBeenCalledTimes(1);
    expect(checkAll).toHaveBeenCalledTimes(1);
    expect(checkAll).toHaveBeenCalledWith({ linearTokenPath: cfg.linearTokenPath });
    expect(result).toEqual(status);
  });
});
