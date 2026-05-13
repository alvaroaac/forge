import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { IpcMain } from 'electron';
import { IpcChannel, type IpcChannelName } from '../../src/shared/ipc-channels';
import type { ConfigStore } from '../../src/main/services/config-store';
import type { Spec } from '../../src/shared/types';
import { registerSpecGetHandler } from '../../src/main/ipc/spec';

type IpcMainHandler = (event: unknown, ...args: unknown[]) => Promise<unknown> | unknown;
type IpcMainLike = {
  handle: (channel: IpcChannelName, listener: IpcMainHandler) => void;
};

type ConfigStoreDouble = Pick<ConfigStore, 'get' | 'set'>;

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'spec-get-'));
});

describe('spec:get', () => {
  it('returns Spec when initial-spec.md exists', async () => {
    const calls = new Map<IpcChannelName, IpcMainHandler>();
    const ipc: IpcMainLike = {
      handle(channel, listener) {
        calls.set(channel, listener);
      },
    };
    const store: ConfigStoreDouble = {
      get: vi.fn().mockResolvedValue({
        linearTokenPath: '/tmp/linear-token.json',
        linearTeamKey: 'FUL',
        repoPath: dir,
        claudeModel: 'claude-sonnet-4-6',
      }),
      set: vi.fn(),
    };

    mkdirSync(join(dir, 'thoughts', 'tasks', 'FUL-7'), { recursive: true });
    const filePath = join(dir, 'thoughts', 'tasks', 'FUL-7', 'initial-spec.md');
    writeFileSync(filePath, '# hi', 'utf-8');
    const expectedGeneratedAt = statSync(filePath).mtime.toISOString();

    registerSpecGetHandler(ipc as IpcMain, store);
    const handler = calls.get(IpcChannel.SpecGet);
    expect(handler).toBeDefined();

    const result = (await handler!({}, { issueId: 'FUL-7' })) as Spec | null;

    expect(result).toEqual({
      issueId: 'FUL-7',
      content: '# hi',
      generatedAt: expectedGeneratedAt,
      approved: false,
    });
  });

  it('returns null when missing', async () => {
    const calls = new Map<IpcChannelName, IpcMainHandler>();
    const ipc: IpcMainLike = {
      handle(channel, listener) {
        calls.set(channel, listener);
      },
    };
    const store: ConfigStoreDouble = {
      get: vi.fn().mockResolvedValue({
        linearTokenPath: '/tmp/linear-token.json',
        linearTeamKey: 'FUL',
        repoPath: dir,
        claudeModel: 'claude-sonnet-4-6',
      }),
      set: vi.fn(),
    };

    registerSpecGetHandler(ipc as IpcMain, store);
    const handler = calls.get(IpcChannel.SpecGet);
    expect(handler).toBeDefined();

    const result = await handler!({}, { issueId: 'NOPE-1' });

    expect(result).toBeNull();
  });
});
