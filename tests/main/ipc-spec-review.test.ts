import { describe, expect, it, vi } from 'vitest';
import type { IpcMain } from 'electron';
import { IpcChannel, type IpcChannelName } from '../../src/shared/ipc-channels';
import type { ConfigStore } from '../../src/main/services/config-store';
import type { SpecReviewResult } from '../../src/shared/types';
import { registerSpecLaunchReviewHandler, registerSpecWriteHandler } from '../../src/main/ipc/spec';

type IpcMainHandler = (event: unknown, ...args: unknown[]) => Promise<unknown> | unknown;

type IpcMainLike = {
  handle: (channel: IpcChannelName, listener: IpcMainHandler) => void;
};

type ConfigStoreDouble = Pick<ConfigStore, 'get' | 'set'>;

function createStore(repoPath: string): ConfigStoreDouble {
  return {
    get: vi.fn().mockResolvedValue({
      linearTokenPath: '/tmp/linear-token.json',
      linearTeamKey: 'FUL',
      repoPath,
      claudeModel: 'claude-sonnet-4-6',
    }),
    set: vi.fn(),
  };
}

describe('spec:launch-review IPC', () => {
  it('passes issue id, content, and model through to the bridge', async () => {
    const calls = new Map<IpcChannelName, IpcMainHandler>();
    const ipc: IpcMainLike = {
      handle(channel, listener) {
        calls.set(channel, listener);
      },
    };
    const launchReview = vi.fn(async (): Promise<SpecReviewResult> => ({
      content: '# Revised',
      summary: {
        verdict: 'approved',
        reviewerSummary: 'Looks good.',
        commentCount: 0,
        appliedChanges: [],
        unresolvedComments: [],
      },
    }));

    registerSpecLaunchReviewHandler(ipc as IpcMain, { launchReview });

    const handler = calls.get(IpcChannel.SpecLaunchReview);
    expect(handler).toBeDefined();

    const result = (await handler!({}, {
      issueId: 'FUL-42',
      content: '# Spec',
      model: 'claude-sonnet-4-6',
    })) as SpecReviewResult;

    expect(launchReview).toHaveBeenCalledWith({
      issueId: 'FUL-42',
      content: '# Spec',
      model: 'claude-sonnet-4-6',
    });
    expect(result.content).toBe('# Revised');
  });

  it('rejects without calling spec persistence', async () => {
    const calls = new Map<IpcChannelName, IpcMainHandler>();
    const ipc: IpcMainLike = {
      handle(channel, listener) {
        calls.set(channel, listener);
      },
    };
    const launchReview = vi.fn(async () => {
      throw new Error('bridge failed');
    });
    const writeSpec = vi.fn();

    registerSpecLaunchReviewHandler(ipc as IpcMain, { launchReview });
    registerSpecWriteHandler(ipc as IpcMain, {
      store: createStore('/tmp/repo'),
      writeSpec,
    });

    const handler = calls.get(IpcChannel.SpecLaunchReview);
    expect(handler).toBeDefined();

    await expect(
      handler!({}, {
        issueId: 'FUL-42',
        content: '# Spec',
        model: 'claude-sonnet-4-6',
      }),
    ).rejects.toThrow('bridge failed');

    expect(writeSpec).not.toHaveBeenCalled();
  });
});
