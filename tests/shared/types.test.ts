import { describe, it, expect, expectTypeOf } from 'vitest';
import type {
  Issue,
  Spec,
  AppConfig,
  AuthStatus,
  IssueStatus,
  Priority,
  SpecReviewSummary,
  SpecReviewResult,
} from '../../src/shared/types';
import { ok, err, type Result } from '../../src/shared/result';

describe('shared types', () => {
  it('Issue has required fields', () => {
    expectTypeOf<Issue>().toHaveProperty('id').toEqualTypeOf<string>();
    expectTypeOf<Issue>().toHaveProperty('status').toEqualTypeOf<IssueStatus>();
    expectTypeOf<Issue>().toHaveProperty('priority').toEqualTypeOf<Priority>();
  });

  it('AppConfig has all four config keys', () => {
    expectTypeOf<AppConfig>().toHaveProperty('linearTokenPath').toEqualTypeOf<string>();
    expectTypeOf<AppConfig>().toHaveProperty('linearTeamKey').toEqualTypeOf<string>();
    expectTypeOf<AppConfig>().toHaveProperty('repoPath').toEqualTypeOf<string>();
    expectTypeOf<AppConfig>().toHaveProperty('claudeModel').toEqualTypeOf<string>();
  });

  it('AuthStatus is boolean-keyed', () => {
    expectTypeOf<AuthStatus>().toEqualTypeOf<{
      linear: boolean;
      claudeCode: boolean;
      codex: boolean;
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
});
