import { renderHook, act, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useSpecStream } from '../../src/renderer/hooks/use-spec-stream';
import type { Spec, SpecStreamChunk } from '../../src/shared/types';

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
};

type ChunkHandler = (chunk: SpecStreamChunk) => void;

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });

  return { promise, resolve, reject };
}

function createSpec(issueId: string, content: string): Spec {
  return {
    issueId,
    content,
    generatedAt: '2026-05-13T12:00:00.000Z',
    approved: false,
  };
}

function setForge(options: {
  get: (issueId: string) => Promise<Spec | null>;
  generate: (issueId: string) => Promise<{ issueId: string; content: string }>;
  onChunk: (handler: ChunkHandler) => () => void;
}) {
  window.forge = {
    auth: { check: vi.fn() },
    config: { get: vi.fn(), set: vi.fn() },
    linear: { fetch: vi.fn(), refresh: vi.fn() },
    spec: options,
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

describe('useSpecStream', () => {
  it('accumulates deltas for the current issue and marks streaming complete when done', async () => {
    const get = vi.fn().mockResolvedValue(null);
    const generation = createDeferred<{ issueId: string; content: string }>();
    const generate = vi.fn(() => generation.promise);
    const handlers: ChunkHandler[] = [];
    const onChunk = vi.fn((handler: ChunkHandler) => {
      handlers.push(handler);
      return vi.fn();
    });

    setForge({ get, generate, onChunk });

    const { result } = renderHook(() => useSpecStream('FUL-7'));

    expect(result.current).toEqual({
      spec: null,
      streaming: '',
      isStreaming: false,
      generate: expect.any(Function),
    });

    await act(async () => {
      void result.current.generate();
    });

    expect(generate).toHaveBeenCalledWith('FUL-7');
    expect(result.current.isStreaming).toBe(true);

    await act(async () => {
      handlers[0]?.({ issueId: 'FUL-7', delta: 'A', done: false });
    });

    await waitFor(() => {
      expect(result.current.streaming).toBe('A');
    });

    await act(async () => {
      handlers[0]?.({ issueId: 'FUL-7', delta: 'B', done: false });
    });

    expect(result.current.streaming).toBe('AB');

    await act(async () => {
      handlers[0]?.({ issueId: 'FUL-7', delta: '', done: true });
    });

    expect(result.current.isStreaming).toBe(false);

    await act(async () => {
      generation.resolve({ issueId: 'FUL-7', content: 'AB' });
      await generation.promise;
    });

    await waitFor(() => {
      expect(result.current.spec).toEqual({
        issueId: 'FUL-7',
        content: 'AB',
        generatedAt: expect.any(String),
        approved: false,
      });
    });
  });

  it('does nothing when the issue id is null', async () => {
    const get = vi.fn().mockResolvedValue(null);
    const generate = vi.fn().mockResolvedValue({ issueId: 'FUL-7', content: 'AB' });
    const onChunk = vi.fn(() => vi.fn());

    setForge({ get, generate, onChunk });

    const { result } = renderHook(() => useSpecStream(null));

    expect(result.current).toEqual({
      spec: null,
      streaming: '',
      isStreaming: false,
      generate: expect.any(Function),
    });

    await act(async () => {
      await result.current.generate();
    });

    expect(get).not.toHaveBeenCalled();
    expect(generate).not.toHaveBeenCalled();
    expect(onChunk).not.toHaveBeenCalled();
    expect(result.current).toEqual({
      spec: null,
      streaming: '',
      isStreaming: false,
      generate: expect.any(Function),
    });
  });

  it('loads the persisted spec for the active issue and ignores stale get results after issue changes', async () => {
    const getA = createDeferred<Spec | null>();
    const getB = createDeferred<Spec | null>();
    const get = vi.fn((issueId: string) => {
      if (issueId === 'FUL-7') {
        return getA.promise;
      }

      if (issueId === 'FUL-8') {
        return getB.promise;
      }

      return Promise.resolve(null);
    });
    const generate = vi.fn().mockResolvedValue({ issueId: 'FUL-7', content: 'draft' });
    const handlers: ChunkHandler[] = [];
    const unsubscribeA = vi.fn();
    const unsubscribeB = vi.fn();
    const onChunk = vi.fn((handler: ChunkHandler) => {
      handlers.push(handler);
      return handlers.length === 1 ? unsubscribeA : unsubscribeB;
    });

    setForge({ get, generate, onChunk });

    const { result, rerender } = renderHook(({ issueId }) => useSpecStream(issueId), {
      initialProps: { issueId: 'FUL-7' as string | null },
    });

    await act(async () => {
      handlers[0]?.({ issueId: 'FUL-7', delta: 'draft ', done: false });
    });

    expect(result.current.streaming).toBe('draft ');

    rerender({ issueId: 'FUL-8' });

    expect(result.current).toEqual({
      spec: null,
      streaming: '',
      isStreaming: false,
      generate: expect.any(Function),
    });
    expect(unsubscribeA).toHaveBeenCalledTimes(1);

    await act(async () => {
      getA.resolve(createSpec('FUL-7', 'stale A'));
      await getA.promise;
    });

    expect(result.current.spec).toBeNull();

    await act(async () => {
      getB.resolve(createSpec('FUL-8', 'fresh B'));
      await getB.promise;
    });

    await waitFor(() => {
      expect(result.current.spec).toEqual(createSpec('FUL-8', 'fresh B'));
    });

    expect(unsubscribeB).not.toHaveBeenCalled();
  });

  it('ignores chunks for other issue ids', async () => {
    const get = vi.fn().mockResolvedValue(null);
    const generate = vi.fn().mockResolvedValue({ issueId: 'FUL-7', content: 'AB' });
    const handlers: ChunkHandler[] = [];
    const onChunk = vi.fn((handler: ChunkHandler) => {
      handlers.push(handler);
      return vi.fn();
    });

    setForge({ get, generate, onChunk });

    const { result } = renderHook(() => useSpecStream('FUL-7'));

    await act(async () => {
      handlers[0]?.({ issueId: 'FUL-8', delta: 'x', done: false });
    });

    expect(result.current.streaming).toBe('');
    expect(result.current.isStreaming).toBe(false);
  });

  it('cleans up the subscription on issue changes and unmount', async () => {
    const getA = vi.fn().mockResolvedValue(null);
    const getB = vi.fn().mockResolvedValue(null);
    const get = vi.fn((issueId: string) => {
      return issueId === 'FUL-7' ? getA() : getB();
    });
    const generate = vi.fn().mockResolvedValue({ issueId: 'FUL-7', content: '' });
    const unsubscribeA = vi.fn();
    const unsubscribeB = vi.fn();
    const handlers: ChunkHandler[] = [];
    const onChunk = vi.fn((handler: ChunkHandler) => {
      handlers.push(handler);
      return handlers.length === 1 ? unsubscribeA : unsubscribeB;
    });

    setForge({ get, generate, onChunk });

    const { rerender, unmount } = renderHook(({ issueId }) => useSpecStream(issueId), {
      initialProps: { issueId: 'FUL-7' as string | null },
    });

    expect(onChunk).toHaveBeenCalledTimes(1);

    rerender({ issueId: 'FUL-8' });

    expect(unsubscribeA).toHaveBeenCalledTimes(1);
    expect(onChunk).toHaveBeenCalledTimes(2);

    unmount();

    expect(unsubscribeB).toHaveBeenCalledTimes(1);
  });

  it('keeps rejected get calls and generate calls from surfacing unhandled rejections', async () => {
    const getDeferred = createDeferred<Spec | null>();
    const generateDeferred = createDeferred<{ issueId: string; content: string }>();
    const get = vi.fn(() => getDeferred.promise);
    const generate = vi.fn(() => generateDeferred.promise);
    const onChunk = vi.fn(() => vi.fn());
    const unhandledRejection = vi.fn((event: PromiseRejectionEvent) => {
      event.preventDefault();
    });

    setForge({ get, generate, onChunk });
    window.addEventListener('unhandledrejection', unhandledRejection);

    try {
      const { result } = renderHook(() => useSpecStream('FUL-7'));

      expect(result.current).toEqual({
        spec: null,
        streaming: '',
        isStreaming: false,
        generate: expect.any(Function),
      });

      getDeferred.reject(new Error('load failed'));
      await waitForNextTick();

      expect(result.current.spec).toBeNull();
      expect(result.current.streaming).toBe('');
      expect(result.current.isStreaming).toBe(false);
      expect(unhandledRejection).not.toHaveBeenCalled();

      let generatePromise: Promise<void> | undefined;

      await act(async () => {
        generatePromise = result.current.generate();
      });

      expect(result.current.isStreaming).toBe(true);

      generateDeferred.reject(new Error('generate failed'));

      await act(async () => {
        await generatePromise;
      });

      await waitForNextTick();

      expect(result.current.spec).toBeNull();
      expect(result.current.streaming).toBe('');
      expect(result.current.isStreaming).toBe(false);
      expect(unhandledRejection).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener('unhandledrejection', unhandledRejection);
    }
  });

  it('survives the StrictMode setup-cleanup-setup cycle without leaking subscriptions', async () => {
    const get = vi.fn().mockResolvedValue(null);
    const generate = vi.fn().mockResolvedValue({ issueId: 'FUL-7', content: '' });
    const handlers: ChunkHandler[] = [];
    const unsubscribeA = vi.fn();
    const unsubscribeB = vi.fn();
    const onChunk = vi.fn((handler: ChunkHandler) => {
      handlers.push(handler);
      return handlers.length === 1 ? unsubscribeA : unsubscribeB;
    });

    setForge({ get, generate, onChunk });

    const { result } = renderHook(() => useSpecStream('FUL-7'), {
      wrapper: StrictMode,
    });

    expect(onChunk).toHaveBeenCalledTimes(2);
    expect(unsubscribeA).toHaveBeenCalledTimes(1);

    await act(async () => {
      handlers.at(-1)?.({ issueId: 'FUL-7', delta: 'live', done: false });
    });

    expect(result.current.streaming).toBe('live');
    expect(result.current.isStreaming).toBe(false);
    expect(handlers).toHaveLength(2);

    expect(handlers.length).toBe(2);
    expect(unsubscribeB).not.toHaveBeenCalled();
  });
});
