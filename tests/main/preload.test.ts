import { describe, it, expect } from 'vitest';
import type { ForgeApi } from '../../src/shared/forge-api';
import type { AppConfig, AuthStatus, Issue, Spec, SpecStreamChunk } from '../../src/shared/types';

describe('ForgeApi shape', () => {
  const promiseFn =
    <T>(value: T): (() => Promise<T>) =>
    async () =>
      value;

  const api: ForgeApi = {
    auth: {
      check: promiseFn<AuthStatus>({
        linear: true,
        claudeCode: false,
        codex: false,
      }),
    },
    linear: {
      fetch: promiseFn<Issue[]>([]),
      refresh: promiseFn<Issue[]>([]),
    },
    spec: {
      get: promiseFn<Spec | null>(null),
      generate: promiseFn<{ issueId: string; content: string }>({
        issueId: 'FUL-1',
        content: '',
      }),
      onChunk: (handler) => {
        handler({
          issueId: 'FUL-1',
          delta: '',
          done: false,
        } satisfies SpecStreamChunk);
        return () => undefined;
      },
    },
    config: {
      get: promiseFn<AppConfig>({
        linearTokenPath: '/tmp/linear-token.json',
        linearTeamKey: 'FUL',
        repoPath: '/tmp/repo',
        claudeModel: 'claude-sonnet-4-0',
      }),
      set: promiseFn<void>(undefined),
    },
  };

  it('has all Phase 1 methods typed', () => {
    expect(api).toBeDefined();
  });
});
