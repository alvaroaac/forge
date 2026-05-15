import { renderHook, act, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useTriageStream } from '../../src/renderer/hooks/use-triage-stream';
import type {
  TriageBrief,
  TriageGenerateDone,
  TriageGenerateError,
  TriageStreamChunk,
} from '../../src/shared/types';

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
};

type ChunkHandler = (chunk: TriageStreamChunk) => void;
type DoneHandler = (payload: TriageGenerateDone) => void;
type ErrorHandler = (payload: TriageGenerateError) => void;

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });

  return { promise, resolve, reject };
}

function createBrief(issueId: string, content: string): TriageBrief {
  return {
    issueId,
    content,
    generatedAt: '2026-05-13T12:00:00.000Z',
  };
}

function setForge(options: {
  generate: (issueId: string, model?: string) => Promise<TriageBrief>;
  onChunk: (handler: ChunkHandler) => () => void;
  onDone?: (handler: DoneHandler) => () => void;
  onError?: (handler: ErrorHandler) => () => void;
}) {
  window.forge = {
    auth: { check: vi.fn() },
    config: { get: vi.fn(), set: vi.fn() },
    linear: {
      fetch: vi.fn(),
      fetchIssueDetail: vi.fn(),
      refresh: vi.fn(),
      fetchTeamTriage: vi.fn(),
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
      generate: options.generate,
      write: vi.fn(),
      onChunk: options.onChunk,
      onDone: options.onDone ?? vi.fn(() => vi.fn()),
      onError: options.onError ?? vi.fn(() => vi.fn()),
    },
  };
}

function waitForNextTick(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useTriageStream', () => {
  it('accumulates deltas and marks streaming complete on done', async () => {
    const generation = createDeferred<TriageBrief>();
    const generate = vi.fn(() => generation.promise);
    const chunks: ChunkHandler[] = [];
    const doneHandlers: DoneHandler[] = [];
    const onChunk = vi.fn((handler: ChunkHandler) => {
      chunks.push(handler);
      return vi.fn();
    });
    const onDone = vi.fn((handler: DoneHandler) => {
      doneHandlers.push(handler);
      return vi.fn();
    });

    setForge({ generate, onChunk, onDone });

    const { result } = renderHook(() => useTriageStream('FUL-7'));

    expect(result.current).toEqual({
      brief: null,
      streaming: '',
      isStreaming: false,
      errorMessage: null,
      generate: expect.any(Function),
    });

    await act(async () => {
      void result.current.generate();
    });

    expect(generate).toHaveBeenCalledWith('FUL-7');
    expect(result.current.isStreaming).toBe(true);

    await act(async () => {
      chunks[0]?.({ issueId: 'FUL-7', delta: 'A', done: false });
    });

    await act(async () => {
      chunks[0]?.({ issueId: 'FUL-7', delta: 'B', done: false });
    });

    expect(result.current.streaming).toBe('AB');

    await act(async () => {
      doneHandlers[0]?.({ issueId: 'FUL-7' });
    });

    expect(result.current.isStreaming).toBe(false);

    await act(async () => {
      generation.resolve(createBrief('FUL-7', 'AB'));
      await generation.promise;
    });

    await waitFor(() => {
      expect(result.current.brief).toEqual(
        expect.objectContaining({
          ...createBrief('FUL-7', 'AB'),
          generatedAt: expect.any(String),
        }),
      );
    });
  });

  it('populates error message from triage error event', async () => {
    const generation = createDeferred<TriageBrief>();
    const generate = vi.fn(() => generation.promise);
    const onChunk = vi.fn(() => vi.fn());
    const errorHandlers: ErrorHandler[] = [];
    const onError = vi.fn((handler: ErrorHandler) => {
      errorHandlers.push(handler);
      return vi.fn();
    });

    setForge({ generate, onChunk, onError });

    const { result } = renderHook(() => useTriageStream('FUL-7'));

    await act(async () => {
      void result.current.generate();
      generation.promise;
    });

    await waitFor(() => {
      expect(result.current.isStreaming).toBe(true);
    });

    await act(async () => {
      errorHandlers[0]?.({ issueId: 'FUL-7', message: 'Claude CLI missing login' });
    });

    expect(result.current.isStreaming).toBe(false);
    expect(result.current.errorMessage).toBe('Claude CLI missing login');
    generation.resolve(createBrief('FUL-7', 'AB'));
    await act(async () => {
      await generation.promise;
    });
  });

  it('removes old subscriptions and resets state when issue id changes', async () => {
    const generate = vi.fn().mockResolvedValue(createBrief('FUL-7', 'first'));
    const chunks: ChunkHandler[] = [];
    const unsubscribeA = vi.fn();
    const unsubscribeB = vi.fn();
    const onChunk = vi.fn((handler: ChunkHandler) => {
      chunks.push(handler);
      return chunks.length === 1 ? unsubscribeA : unsubscribeB;
    });

    setForge({ generate, onChunk });

    const { result, rerender } = renderHook(({ issueId }) => useTriageStream(issueId), {
      initialProps: { issueId: 'FUL-7' as string | null },
    });

    await act(async () => {
      chunks[0]?.({ issueId: 'FUL-7', delta: 'first', done: false });
    });

    expect(result.current.streaming).toBe('first');
    expect(result.current.isStreaming).toBe(false);

    rerender({ issueId: 'FUL-8' });

    expect(unsubscribeA).toHaveBeenCalledTimes(1);
    expect(result.current).toEqual({
      brief: null,
      streaming: '',
      isStreaming: false,
      errorMessage: null,
      generate: expect.any(Function),
    });

    await act(async () => {
      chunks[1]?.({ issueId: 'FUL-8', delta: 'second', done: false });
    });

    expect(result.current.streaming).toBe('second');
  });

  it('ignores stale events for a non-current run', async () => {
    const generationA = createDeferred<TriageBrief>();
    const generationB = createDeferred<TriageBrief>();
    const getGenerate = vi.fn((issueId: string) =>
      issueId === 'FUL-7' ? generationA.promise : generationB.promise,
    );
    const handlers: ChunkHandler[] = [];
    const onChunk = vi.fn((handler: ChunkHandler) => {
      handlers.push(handler);
      return vi.fn();
    });

    setForge({ generate: getGenerate, onChunk });

    const { result, rerender } = renderHook(({ issueId }) => useTriageStream(issueId), {
      initialProps: { issueId: 'FUL-7' as string | null },
    });

    await act(async () => {
      void result.current.generate();
      rerender({ issueId: 'FUL-8' });
    });

    await act(async () => {
      void result.current.generate();
    });

    await act(async () => {
      handlers[0]?.({ issueId: 'FUL-7', delta: 'stale', done: false });
      handlers[1]?.({ issueId: 'FUL-8', delta: 'active', done: false });
    });

    expect(result.current.streaming).toBe('active');

    await act(async () => {
      generationA.resolve(createBrief('FUL-7', 'stale'));
      generationB.resolve(createBrief('FUL-8', 'active'));
      await generationB.promise;
      await generationA.promise;
    });

    await waitFor(() => {
      expect(result.current.brief).toEqual(
        expect.objectContaining({
          ...createBrief('FUL-8', 'active'),
          generatedAt: expect.any(String),
        }),
      );
    });

    expect(result.current.brief).toEqual(expect.objectContaining({ issueId: 'FUL-8', content: 'active' }));
    expect(result.current.streaming).toBe('active');
  });

  it('keeps rejected triage generation from surfacing unhandled rejections', async () => {
    const generateDeferred = createDeferred<TriageBrief>();
    const generate = vi.fn(() => generateDeferred.promise);
    const onChunk = vi.fn(() => vi.fn());
    const unhandledRejection = vi.fn((event: PromiseRejectionEvent) => {
      event.preventDefault();
    });

    setForge({ generate, onChunk });
    window.addEventListener('unhandledrejection', unhandledRejection);

    try {
      const { result } = renderHook(() => useTriageStream('FUL-7'));

      let generatePromise: Promise<void> | undefined;

      await act(async () => {
        generatePromise = result.current.generate();
      });

      generateDeferred.reject(new Error('generate failed'));

      await act(async () => {
        await generatePromise;
      });

      await waitForNextTick();

      expect(result.current.errorMessage).toBe('generate failed');
      expect(result.current.isStreaming).toBe(false);
      expect(unhandledRejection).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener('unhandledrejection', unhandledRejection);
    }
  });
});
