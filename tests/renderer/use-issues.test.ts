import { renderHook, act, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useIssues } from '../../src/renderer/hooks/use-issues';
import type { Issue } from '../../src/shared/types';

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
};

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });

  return { promise, resolve, reject };
}

function createIssue(id: string, assigneeId: string | null = null): Issue {
  return {
    id,
    title: id,
    description: '',
    status: 'todo',
    priority: 'none',
    labels: [],
    url: '',
    updatedAt: '2026-05-13T00:00:00.000Z',
    isBug: false,
    assigneeId,
  };
}

function setForge(
  fetch: () => Promise<Issue[]>,
  refresh: () => Promise<Issue[]>,
  fetchTeamTriage: () => Promise<Issue[]> = vi.fn(async () => []),
) {
  window.forge = {
    auth: { check: vi.fn() },
    config: { get: vi.fn(), set: vi.fn() },
    linear: {
      fetch,
      fetchIssueDetail: vi.fn(),
      refresh,
      fetchTeamTriage,
      getViewerId: vi.fn(),
    },
    spec: {
      get: vi.fn(),
      generate: vi.fn(),
      write: vi.fn(),
      launchReview: vi.fn(),
      onChunk: vi.fn(),
      onDone: vi.fn(),
      onError: vi.fn(),
    },
    triage: {
      generate: vi.fn(),
      write: vi.fn(),
      onChunk: vi.fn(),
      onDone: vi.fn(),
      onError: vi.fn(),
    },
  };
}

function waitForNextTick(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('useIssues', () => {
  it('starts empty with a zero sync timestamp', () => {
    const fetch = vi.fn(() => new Promise<Issue[]>(() => {}));
    const refresh = vi.fn(() => new Promise<Issue[]>(() => {}));
    setForge(fetch, refresh);

    const { result } = renderHook(() => useIssues());

    expect(result.current.issues).toEqual([]);
    expect(result.current.lastSync).toBe(0);
  });

  it('seeds from cache then refreshes to fresh data', async () => {
    const fetch = vi.fn().mockResolvedValue([createIssue('CACHE')]);
    const mountRefresh = createDeferred<Issue[]>();
    const refresh = vi
      .fn()
      .mockImplementationOnce(() => mountRefresh.promise)
      .mockResolvedValueOnce([createIssue('FRESH')]);
    setForge(fetch, refresh);

    const { result } = renderHook(() => useIssues());

    await waitFor(() => {
      expect(result.current.issues[0]?.id).toBe('CACHE');
    });

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.issues[0]?.id).toBe('FRESH');

    await act(async () => {
      mountRefresh.resolve([createIssue('STALE')]);
      await mountRefresh.promise;
    });

    expect(result.current.issues[0]?.id).toBe('FRESH');
  });

  it('survives the StrictMode setup-cleanup-setup cycle and still seeds then refreshes', async () => {
    const fetch = vi.fn().mockResolvedValue([createIssue('CACHE')]);
    const refresh = vi.fn().mockResolvedValue([createIssue('FRESH')]);
    setForge(fetch, refresh);

    const { result } = renderHook(() => useIssues(), {
      wrapper: StrictMode,
    });

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    await waitFor(() => {
      expect(refresh).toHaveBeenCalledTimes(1);
      expect(result.current.issues[0]?.id).toBe('FRESH');
    });
  });

  it('updates lastSync when refresh succeeds', async () => {
    const fetch = vi.fn().mockResolvedValue([]);
    const refresh = vi.fn().mockResolvedValue([]);
    const now = vi.spyOn(Date, 'now');
    now.mockReturnValueOnce(111).mockReturnValueOnce(222);
    setForge(fetch, refresh);

    const { result } = renderHook(() => useIssues());

    await waitFor(() => {
      expect(result.current.lastSync).toBe(111);
    });

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.lastSync).toBe(222);
  });

  it('polls every 60 seconds and stops after unmount', async () => {
    vi.useFakeTimers();

    const fetch = vi.fn().mockResolvedValue([]);
    const refresh = vi.fn().mockResolvedValue([]);
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');
    setForge(fetch, refresh);

    const { unmount } = renderHook(() => useIssues());

    await act(async () => {
      await Promise.resolve();
    });

    expect(refresh).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });

    expect(refresh).toHaveBeenCalledTimes(2);

    unmount();

    expect(clearIntervalSpy).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });

    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('merges assigned issues with team-triage issues', async () => {
    const fetch = vi.fn().mockResolvedValue([createIssue('CACHE')]);
    const refresh = vi.fn().mockResolvedValue([createIssue('ASSIGNED', 'dev-1')]);
    const fetchTeamTriage = vi
      .fn()
      .mockResolvedValue([
        createIssue('TRIAGE_UNASSIGNED'),
        createIssue('TRIAGE_ASSIGNED', 'triage-agent'),
      ]);
    setForge(fetch, refresh, fetchTeamTriage);

    const { result } = renderHook(() => useIssues());

    await waitFor(() => {
      expect(result.current.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: 'ASSIGNED', assigneeId: 'dev-1' }),
          expect.objectContaining({ id: 'TRIAGE_UNASSIGNED', assigneeId: null }),
          expect.objectContaining({ id: 'TRIAGE_ASSIGNED', assigneeId: 'triage-agent' }),
        ]),
      );
    });

    expect(fetchTeamTriage).toHaveBeenCalledTimes(1);
  });

  it('still applies assigned issue refreshes when team triage fetch rejects', async () => {
    const fetch = vi.fn().mockResolvedValue([createIssue('CACHE')]);
    const refresh = vi.fn().mockResolvedValue([createIssue('ASSIGNED', 'dev-1')]);
    const fetchTeamTriage = vi.fn().mockRejectedValue(new Error('triage unavailable'));
    setForge(fetch, refresh, fetchTeamTriage);

    const { result } = renderHook(() => useIssues());

    await waitFor(() => {
      expect(result.current.issues).toEqual([
        expect.objectContaining({ id: 'ASSIGNED', assigneeId: 'dev-1' }),
      ]);
    });

    expect(fetchTeamTriage).toHaveBeenCalledTimes(1);
  });

  it('re-fetches both assigned and triage endpoints during refresh', async () => {
    const fetch = vi.fn().mockResolvedValue([createIssue('CACHE')]);
    const refresh = vi.fn().mockResolvedValue([createIssue('ASSIGNED')]);
    const fetchTeamTriage = vi.fn().mockResolvedValue([createIssue('TRIAGE')]);
    setForge(fetch, refresh, fetchTeamTriage);

    const { result } = renderHook(() => useIssues());

    await waitFor(() => {
      expect(refresh).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      await result.current.refresh();
    });

    expect(refresh).toHaveBeenCalledTimes(2);
    expect(fetchTeamTriage).toHaveBeenCalledTimes(2);
  });

  it('prefers triage data when issue ids overlap', async () => {
    const fetch = vi.fn().mockResolvedValue([createIssue('CACHE')]);
    const refresh = vi.fn().mockResolvedValue([createIssue('DUPLICATE', 'assigned-owner')]);
    const fetchTeamTriage = vi.fn().mockResolvedValue([createIssue('DUPLICATE', 'triage-owner')]);
    setForge(fetch, refresh, fetchTeamTriage);

    const { result } = renderHook(() => useIssues());

    await waitFor(() => {
      const issues = result.current.issues.filter((issue) => issue.id === 'DUPLICATE');
      expect(issues).toHaveLength(1);
      expect(issues[0].assigneeId).toBe('triage-owner');
    });
  });

  it('keeps defaults when fetch rejects without surfacing an unhandled rejection', async () => {
    const fetch = vi.fn().mockRejectedValue(new Error('fetch failed'));
    const refresh = vi.fn().mockResolvedValue([]);
    const unhandledRejection = vi.fn((event: PromiseRejectionEvent) => {
      event.preventDefault();
    });

    setForge(fetch, refresh);
    window.addEventListener('unhandledrejection', unhandledRejection);

    try {
      const { result } = renderHook(() => useIssues());

      expect(result.current.issues).toEqual([]);
      expect(result.current.lastSync).toBe(0);

      await waitForNextTick();

      expect(result.current.issues).toEqual([]);
      expect(result.current.lastSync).toBe(0);
      expect(unhandledRejection).not.toHaveBeenCalled();
      expect(refresh).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener('unhandledrejection', unhandledRejection);
    }
  });

  it('keeps the seeded issues when refresh rejects without surfacing an unhandled rejection', async () => {
    const fetch = vi.fn().mockResolvedValue([createIssue('CACHE')]);
    const refresh = vi.fn().mockRejectedValue(new Error('refresh failed'));
    const unhandledRejection = vi.fn((event: PromiseRejectionEvent) => {
      event.preventDefault();
    });

    setForge(fetch, refresh);
    window.addEventListener('unhandledrejection', unhandledRejection);

    try {
      const { result } = renderHook(() => useIssues());

      await waitFor(() => {
        expect(result.current.issues[0]?.id).toBe('CACHE');
      });

      await expect(result.current.refresh()).resolves.toBeUndefined();

      expect(result.current.issues[0]?.id).toBe('CACHE');
      expect(unhandledRejection).not.toHaveBeenCalled();
      expect(refresh).toHaveBeenCalledTimes(2);
    } finally {
      window.removeEventListener('unhandledrejection', unhandledRejection);
    }
  });
});
