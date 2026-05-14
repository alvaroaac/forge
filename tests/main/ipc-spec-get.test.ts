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
  const createStore = (repoPath: string): ConfigStoreDouble => ({
    get: vi.fn().mockResolvedValue({
      linearTokenPath: '/tmp/linear-token.json',
      linearTeamKey: 'FUL',
      repoPath,
      claudeModel: 'claude-sonnet-4-6',
    }),
    set: vi.fn(),
  });

  const createHandler = (store: ConfigStoreDouble): IpcMainHandler => {
    const calls = new Map<IpcChannelName, IpcMainHandler>();
    const ipc: IpcMainLike = {
      handle(channel, listener) {
        calls.set(channel, listener);
      },
    };

    registerSpecGetHandler(ipc as IpcMain, store);
    const handler = calls.get(IpcChannel.SpecGet);
    expect(handler).toBeDefined();

    return handler!;
  };

  it('returns Spec when initial-spec.md exists', async () => {
    const store = createStore(dir);

    mkdirSync(join(dir, 'thoughts', 'tasks', 'FUL-7'), { recursive: true });
    const filePath = join(dir, 'thoughts', 'tasks', 'FUL-7', 'initial-spec.md');
    writeFileSync(filePath, '# hi', 'utf-8');
    const expectedGeneratedAt = statSync(filePath).mtime.toISOString();

    const handler = createHandler(store);

    const result = (await handler({}, { issueId: 'FUL-7' })) as Spec | null;

    expect(result).toEqual({
      issueId: 'FUL-7',
      content: '# hi',
      generatedAt: expectedGeneratedAt,
      approved: false,
    });
  });

  it('cleans saved Claude wrapper text before returning Spec content', async () => {
    const store = createStore(dir);

    mkdirSync(join(dir, 'thoughts', 'tasks', 'FUL-7'), { recursive: true });
    const filePath = join(dir, 'thoughts', 'tasks', 'FUL-7', 'initial-spec.md');
    writeFileSync(
      filePath,
      'Permission needed\n\n```markdown\n# Spec: FUL-7\n\n## Task Summary\nBody\n```',
      'utf-8',
    );

    const handler = createHandler(store);

    const result = (await handler({}, { issueId: 'FUL-7' })) as Spec | null;

    expect(result?.content).toBe('# Spec: FUL-7\n\n## Task Summary\nBody');
  });

  it('returns Spec for safe project slug issue id', async () => {
    const store = createStore(dir);
    mkdirSync(join(dir, 'thoughts', 'tasks', 'phase1-mvp'), { recursive: true });
    const filePath = join(dir, 'thoughts', 'tasks', 'phase1-mvp', 'initial-spec.md');
    writeFileSync(filePath, '# project spec', 'utf-8');
    const expectedGeneratedAt = statSync(filePath).mtime.toISOString();

    const handler = createHandler(store);

    const result = (await handler({}, { issueId: 'phase1-mvp' })) as Spec | null;

    expect(result).toEqual({
      issueId: 'phase1-mvp',
      content: '# project spec',
      generatedAt: expectedGeneratedAt,
      approved: false,
    });
  });

  it('returns null when missing', async () => {
    const store = createStore(dir);
    const handler = createHandler(store);

    const result = await handler({}, { issueId: 'NOPE-1' });

    expect(result).toBeNull();
  });

  it.each(['../x', 'x/y', '', '/tmp/absolute', '\\windows\\style'])(
    'returns null for unsafe issueId: %s',
    async (issueId) => {
      const store = createStore(dir);
      const handler = createHandler(store);

      const result = await handler({}, { issueId });

      expect(result).toBeNull();
    },
  );

  it('does not read outside-repo path fragments', async () => {
    const parentDir = mkdtempSync(join(tmpdir(), 'spec-get-parent-'));
    const repoPath = join(parentDir, 'repo');
    const outsidePath = join(parentDir, 'outside', 'initial-spec.md');
    mkdirSync(repoPath, { recursive: true });
    mkdirSync(join(parentDir, 'outside'), { recursive: true });
    writeFileSync(outsidePath, '# outside file', 'utf-8');

    const store = createStore(repoPath);
    const handler = createHandler(store);

    const traversalId = '../../outside';
    const result = await handler({}, { issueId: traversalId });

    expect(result).toBeNull();
  });
});
