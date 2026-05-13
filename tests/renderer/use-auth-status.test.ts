import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useAuthStatus } from '../../src/renderer/hooks/use-auth-status';
import { useConfig } from '../../src/renderer/hooks/use-config';
import type { AppConfig, AuthStatus } from '../../src/shared/types';

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });

  return { promise, resolve };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useAuthStatus', () => {
  it('starts with all connections false and applies the resolved auth status', async () => {
    const deferred = createDeferred<AuthStatus>();
    const check = vi.fn(() => deferred.promise);

    window.forge = {
      auth: { check },
      config: { get: vi.fn(), set: vi.fn() },
      linear: { fetch: vi.fn(), refresh: vi.fn() },
      spec: { get: vi.fn(), generate: vi.fn(), onChunk: vi.fn() },
    };

    const { result } = renderHook(() => useAuthStatus());

    expect(result.current).toEqual({
      linear: false,
      claudeCode: false,
      codex: false,
    });

    deferred.resolve({
      linear: true,
      claudeCode: true,
      codex: false,
    });

    await waitFor(() => {
      expect(result.current).toEqual({
        linear: true,
        claudeCode: true,
        codex: false,
      });
    });

    expect(check).toHaveBeenCalledTimes(1);
  });
});

describe('useConfig', () => {
  it('starts as null and applies the resolved config', async () => {
    const deferred = createDeferred<AppConfig>();
    const get = vi.fn(() => deferred.promise);

    window.forge = {
      auth: { check: vi.fn() },
      config: { get, set: vi.fn() },
      linear: { fetch: vi.fn(), refresh: vi.fn() },
      spec: { get: vi.fn(), generate: vi.fn(), onChunk: vi.fn() },
    };

    const { result } = renderHook(() => useConfig());

    expect(result.current).toBeNull();

    deferred.resolve({
      linearTokenPath: '/tmp/linear-token',
      linearTeamKey: 'FUL',
      repoPath: '/tmp/repo',
      claudeModel: 'claude-sonnet-4',
    });

    await waitFor(() => {
      expect(result.current).toEqual({
        linearTokenPath: '/tmp/linear-token',
        linearTeamKey: 'FUL',
        repoPath: '/tmp/repo',
        claudeModel: 'claude-sonnet-4',
      });
    });

    expect(get).toHaveBeenCalledTimes(1);
  });
});
