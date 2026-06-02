import { describe, it, expect, expectTypeOf } from 'vitest';
import type {
  Issue,
  Spec,
  AppConfig,
  AuthStatus,
  IssueStatus,
  Priority,
  TriageBrief,
  TriageGenerateDone,
  TriageGenerateError,
  TriageStreamChunk,
  TriageWriteResult,
  SpecReviewSummary,
  SpecReviewResult,
  CommentFetchResult,
  CommentSummaryResult,
} from '../../src/shared/types';
import { ok, err, type Result } from '../../src/shared/result';

describe('shared types', () => {
  it('Issue has required fields', () => {
    expectTypeOf<Issue>().toHaveProperty('id').toEqualTypeOf<string>();
    expectTypeOf<Issue>().toHaveProperty('status').toEqualTypeOf<IssueStatus>();
    expectTypeOf<Issue>().toHaveProperty('priority').toEqualTypeOf<Priority>();
  });

  it('AppConfig has all expected config keys', () => {
    expectTypeOf<AppConfig>().toHaveProperty('linearTokenPath').toEqualTypeOf<string>();
    expectTypeOf<AppConfig>().toHaveProperty('linearTeamKey').toEqualTypeOf<string>();
    expectTypeOf<AppConfig>().toHaveProperty('repoPath').toEqualTypeOf<string>();
    expectTypeOf<AppConfig>().toHaveProperty('computronRepoPath').toEqualTypeOf<string>();
    expectTypeOf<AppConfig>().toHaveProperty('claudeModel').toEqualTypeOf<string>();
  });

  it('AuthStatus is boolean-keyed', () => {
    expectTypeOf<AuthStatus>().toEqualTypeOf<{
      linear: boolean;
      claudeCode: boolean;
      codex: boolean;
      computron: boolean;
    }>();
  });

  it('Spec has expected required fields', () => {
    expectTypeOf<Spec>().toHaveProperty('issueId').toEqualTypeOf<string>();
  });

  it('Result helpers preserve custom error types', () => {
    expectTypeOf(ok<string, 'not-found'>('value')).toEqualTypeOf<Result<string, 'not-found'>>();
    expectTypeOf(err<number>(42)).toEqualTypeOf<Result<never, number>>();
  });

  it('SpecReviewSummary has durable review fields', () => {
    expectTypeOf<SpecReviewSummary>().toEqualTypeOf<{
      verdict: 'approved' | 'changes_requested';
      reviewerSummary: string;
      commentCount: number;
      appliedChanges: string[];
      unresolvedComments: string[];
    }>();
  });

  it('SpecReviewResult carries revised content and summary', () => {
    expectTypeOf<SpecReviewResult>().toEqualTypeOf<{
      content: string;
      summary: SpecReviewSummary;
    }>();
  });

  it('allows triage as a valid IssueStatus', () => {
    const status: IssueStatus = 'triage';
    expect(status).toBe('triage');
  });

  it('supports triage stream chunk payload', () => {
    expectTypeOf<TriageStreamChunk>().toEqualTypeOf<{
      issueId: string;
      delta: string;
      done: boolean;
      status?: string;
    }>();
  });

  it('supports triage generate-done payload', () => {
    expectTypeOf<TriageGenerateDone>().toEqualTypeOf<{
      issueId: string;
    }>();
  });

  it('supports triage generate-error payload', () => {
    expectTypeOf<TriageGenerateError>().toEqualTypeOf<{
      issueId: string;
      message: string;
    }>();
  });

  it('supports triage brief payload', () => {
    expectTypeOf<TriageBrief>().toEqualTypeOf<{
      issueId: string;
      content: string;
      generatedAt: string;
    }>();
  });

  it('supports triage write-result payload', () => {
    expectTypeOf<TriageWriteResult>().toEqualTypeOf<{
      issueId: string;
      path: string;
      written: boolean;
      exists: boolean;
    }>();
  });

  it('supports manual comment summary results', () => {
    expectTypeOf<CommentSummaryResult>().toEqualTypeOf<{
      issueId: string;
      comments: Array<{
        id: string;
        body: string;
        createdAt: string;
        authorName: string;
        isBot: boolean;
      }>;
      commentCount: number;
      summary: string;
      skippedReason?: 'missing-uuid' | 'no-comments';
      errorMessage?: string;
    }>();
  });

  it('supports manual comment fetch results', () => {
    expectTypeOf<CommentFetchResult>().toEqualTypeOf<{
      issueId: string;
      comments: Array<{
        id: string;
        body: string;
        createdAt: string;
        authorName: string;
        isBot: boolean;
      }>;
      commentCount: number;
      skippedReason?: 'missing-uuid' | 'no-comments';
      errorMessage?: string;
    }>();
  });
});
