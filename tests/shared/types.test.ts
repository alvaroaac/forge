import { describe, it, expectTypeOf } from 'vitest';
import type {
  Issue,
  Spec,
  AppConfig,
  AuthStatus,
  IssueStatus,
  Priority,
} from '../../src/shared/types';

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
});
