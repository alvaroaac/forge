import { describe, it, expect } from 'vitest';
import type { ForgeApi } from '../../src/shared/forge-api';
import type {
  AppConfig,
  AuthStatus,
  Issue,
  Spec,
  SpecReviewResult,
  SpecStreamChunk,
} from '../../src/shared/types';

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
      fetchIssueDetail: promiseFn<Issue | null>(null),
      refresh: promiseFn<Issue[]>([]),
    },
    spec: {
      get: promiseFn<Spec | null>(null),
      generate: promiseFn<{ issueId: string; content: string }>({
        issueId: 'FUL-1',
        content: '',
      }),
      write: promiseFn<{ issueId: string; content: string }>({
        issueId: 'FUL-1',
        content: '',
      }),
      launchReview: promiseFn<SpecReviewResult>({
        content: '# Revised',
        summary: {
          verdict: 'approved',
          reviewerSummary: 'Looks good.',
          commentCount: 0,
          appliedChanges: [],
          unresolvedComments: [],
        },
      }),
      onChunk: (handler) => {
        handler({
          issueId: 'FUL-1',
          delta: '',
          done: false,
        } satisfies SpecStreamChunk);
        return () => undefined;
      },
      onDone: (handler) => {
        handler({ issueId: 'FUL-1' });
        return () => undefined;
      },
      onError: (handler) => {
        handler({ issueId: 'FUL-1', message: 'failed' });
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
