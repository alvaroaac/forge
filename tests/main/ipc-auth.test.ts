import { describe, it, expect, vi } from 'vitest';
import type { IpcMain } from 'electron';
import type { ConfigStore } from '../../src/main/services/config-store';
import type { AuthStatus, AppConfig } from '../../src/shared/types';
import { IpcChannel, type IpcChannelName } from '../../src/shared/ipc-channels';
import { registerAuthHandlers } from '../../src/main/ipc/auth';
import type { LinearAuthClient } from '../../src/main/services/auth-checker';

type IpcMainHandler = (event: unknown, ...args: unknown[]) => Promise<unknown> | unknown;
type IpcMainLike = {
  handle: (channel: IpcChannelName, listener: IpcMainHandler) => void;
};

type ConfigStoreDouble = Pick<ConfigStore, 'get' | 'set'>;
type CheckAllFn = (params: {
  linearTokenPath: string;
  linearClient: LinearAuthClient;
  computronRepoPath: string;
}) => Promise<AuthStatus>;

function createLinearClient(): LinearAuthClient {
  return {
    checkAuth: vi.fn(),
  };
}

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
    const linearClient = createLinearClient();

    registerAuthHandlers(ipc as IpcMain, store, checkAll, linearClient);

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
      computronRepoPath: '',
      claudeModel: 'claude-sonnet-4-6',
    };
    const status: AuthStatus = { linear: true, claudeCode: false, codex: true, computron: false };
    const store: ConfigStoreDouble = {
      get: vi.fn().mockResolvedValue(cfg),
      set: vi.fn(),
    };
    const checkAll: CheckAllFn = vi.fn().mockResolvedValue(status);
    const linearClient = createLinearClient();

    registerAuthHandlers(ipc as IpcMain, store, checkAll, linearClient);
    const handler = registered.get(IpcChannel.AuthCheck);
    expect(handler).toBeDefined();

    const result = await handler!({}, []);

    expect(store.get).toHaveBeenCalledTimes(1);
    expect(checkAll).toHaveBeenCalledTimes(1);
    expect(checkAll).toHaveBeenCalledWith({
      linearTokenPath: cfg.linearTokenPath,
      linearClient,
      computronRepoPath: cfg.computronRepoPath,
    });
    expect(result).toEqual(status);
  });
});
