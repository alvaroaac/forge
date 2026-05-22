import { renderHook, act, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useTriageStream } from '../../src/renderer/hooks/use-triage-stream';
import type {
  TriageBrief,
  TriageGenerateDone,
  TriageGenerateError,
  TriagePhaseEvent,
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
type PhaseHandler = (payload: TriagePhaseEvent) => void;

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
  get?: (issueId: string) => Promise<TriageBrief | null>;
  generate: (issueId: string, model?: string) => Promise<TriageBrief>;
  onChunk: (handler: ChunkHandler) => () => void;
  onDone?: (handler: DoneHandler) => () => void;
  onError?: (handler: ErrorHandler) => () => void;
  onPhase?: (handler: PhaseHandler) => () => void;
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
      onPhase: vi.fn(() => vi.fn()),
    },
    triage: {
      get: options.get ?? vi.fn().mockResolvedValue(null),
      generate: options.generate,
      write: vi.fn(),
      onChunk: options.onChunk,
      onDone: options.onDone ?? vi.fn(() => vi.fn()),
      onError: options.onError ?? vi.fn(() => vi.fn()),
      onPhase: options.onPhase ?? vi.fn(() => vi.fn()),
    },
  };
}

function createHandlerRegistry<TPayload>(): {
  handlers: Array<(payload: TPayload) => void>;
  subscribe: (handler: (payload: TPayload) => void) => () => void;
  emit: (payload: TPayload) => void;
} {
  const handlers: Array<(payload: TPayload) => void> = [];

  return {
    handlers,
    subscribe: vi.fn((handler: (payload: TPayload) => void) => {
      handlers.push(handler);
      return vi.fn(() => {
        const index = handlers.indexOf(handler);
        if (index >= 0) {
          handlers.splice(index, 1);
        }
      });
    }),
    emit: (payload: TPayload) => {
      handlers.forEach((handler) => handler(payload));
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
  it('loads a persisted triage brief for the active issue', async () => {
    const persisted = createBrief('FUL-7', '# saved brief');
    const get = vi.fn().mockResolvedValue(persisted);
    const generate = vi.fn().mockResolvedValue(createBrief('FUL-7', '# generated'));
    const onChunk = vi.fn(() => vi.fn());

    setForge({ get, generate, onChunk });

    const { result } = renderHook(() => useTriageStream('FUL-7'));

    await waitFor(() => {
      expect(result.current.brief).toEqual(persisted);
      expect(result.current.isBriefPersisted).toBe(true);
      expect(result.current.isBriefLoading).toBe(false);
    });
  });

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
      streamStatus: [],
      isBriefPersisted: false,
      isBriefLoading: true,
      isStreaming: false,
      errorMessage: null,
      phase: 'idle',
      commentCount: undefined,
      generate: expect.any(Function),
    });

    await act(async () => {
      void result.current.generate();
    });

    expect(generate).toHaveBeenCalledWith('FUL-7');
    expect(result.current.isStreaming).toBe(true);
    expect(result.current.streamStatus).toEqual(['Starting Claude']);

    await act(async () => {
      chunks[0]?.({
        issueId: 'FUL-7',
        delta: '',
        done: false,
        status: 'Claude initialized the repo session',
      });
    });

    await act(async () => {
      chunks[0]?.({ issueId: 'FUL-7', delta: 'A', done: false });
    });

    await act(async () => {
      chunks[0]?.({
        issueId: 'FUL-7',
        delta: 'B',
        done: false,
        status: 'Claude is drafting the brief',
      });
    });

    expect(result.current.streaming).toBe('AB');
    expect(result.current.streamStatus).toEqual([
      'Starting Claude',
      'Claude initialized the repo session',
      'Claude is drafting the brief',
    ]);

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
      streamStatus: [],
      isBriefPersisted: false,
      isBriefLoading: true,
      isStreaming: false,
      errorMessage: null,
      phase: 'idle',
      commentCount: undefined,
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

    expect(result.current.brief).toEqual(
      expect.objectContaining({ issueId: 'FUL-8', content: 'active' }),
    );
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

  it('ignores stale rejected generations after navigation and returns to a newer setup', async () => {
    const generationA = createDeferred<TriageBrief>();
    const generationB = createDeferred<TriageBrief>();
    const generationC = createDeferred<TriageBrief>();
    let ful7Count = 0;
    const generate = vi.fn((issueId: string) => {
      if (issueId === 'FUL-8') {
        return generationB.promise;
      }

      ful7Count += 1;
      if (ful7Count === 1) {
        return generationA.promise;
      }

      return generationC.promise;
    });

    const onChunk = vi.fn(() => vi.fn());

    setForge({ generate, onChunk });

    const { result, rerender } = renderHook(({ issueId }) => useTriageStream(issueId), {
      initialProps: { issueId: 'FUL-7' as string | null },
    });

    await act(async () => {
      void result.current.generate();
    });

    await act(async () => {
      rerender({ issueId: 'FUL-8' });
    });

    await act(async () => {
      void result.current.generate();
    });

    await act(async () => {
      rerender({ issueId: 'FUL-7' });
    });

    await act(async () => {
      void result.current.generate();
    });

    await act(async () => {
      generationB.resolve(createBrief('FUL-8', 'other'));
      generationA.reject(new Error('stale run failed'));
      generationC.resolve(createBrief('FUL-7', 'fresh'));
      await generationB.promise;
      await generationC.promise;
    });

    await waitFor(() => {
      expect(result.current.brief).toEqual(
        expect.objectContaining({ issueId: 'FUL-7', content: 'fresh' }),
      );
    });

    expect(result.current.errorMessage).toBeNull();
    expect(result.current.isStreaming).toBe(false);
    expect(result.current.brief).toEqual(
      expect.objectContaining({ issueId: 'FUL-7', content: 'fresh' }),
    );
  });

  describe('phase state', () => {
    it('starts at idle before any phase event', () => {
      const generate = vi.fn().mockResolvedValue(createBrief('FUL-77', '# generated'));
      const onChunk = vi.fn(() => vi.fn());

      setForge({ generate, onChunk });

      const { result } = renderHook(() => useTriageStream('FUL-77'));

      expect(result.current.phase).toBe('idle');
      expect(result.current.commentCount).toBeUndefined();
    });

    it('transitions to triaging with commentCount on a matching triaging phase event', () => {
      const generate = vi.fn().mockResolvedValue(createBrief('FUL-77', '# generated'));
      const onChunk = vi.fn(() => vi.fn());
      const phase = createHandlerRegistry<TriagePhaseEvent>();

      setForge({ generate, onChunk, onPhase: phase.subscribe });

      const { result } = renderHook(() => useTriageStream('FUL-77'));

      act(() => {
        phase.emit({ issueId: 'FUL-77', phase: 'triaging', commentCount: 3 });
      });

      expect(result.current.phase).toBe('triaging');
      expect(result.current.commentCount).toBe(3);
    });

    it('transitions to generating after a generating phase event', () => {
      const generate = vi.fn().mockResolvedValue(createBrief('FUL-77', '# generated'));
      const onChunk = vi.fn(() => vi.fn());
      const phase = createHandlerRegistry<TriagePhaseEvent>();

      setForge({ generate, onChunk, onPhase: phase.subscribe });

      const { result } = renderHook(() => useTriageStream('FUL-77'));

      act(() => {
        phase.emit({ issueId: 'FUL-77', phase: 'triaging', commentCount: 1 });
        phase.emit({ issueId: 'FUL-77', phase: 'generating' });
      });

      expect(result.current.phase).toBe('generating');
      expect(result.current.commentCount).toBe(1);
    });

    it('transitions to done on the done event', () => {
      const generate = vi.fn().mockResolvedValue(createBrief('FUL-77', '# generated'));
      const onChunk = vi.fn(() => vi.fn());
      const phase = createHandlerRegistry<TriagePhaseEvent>();
      const done = createHandlerRegistry<TriageGenerateDone>();

      setForge({ generate, onChunk, onDone: done.subscribe, onPhase: phase.subscribe });

      const { result } = renderHook(() => useTriageStream('FUL-77'));

      act(() => {
        phase.emit({ issueId: 'FUL-77', phase: 'generating' });
        done.emit({ issueId: 'FUL-77' });
      });

      expect(result.current.phase).toBe('done');
    });

    it('leaves phase as-is on the error event', () => {
      const generate = vi.fn().mockResolvedValue(createBrief('FUL-77', '# generated'));
      const onChunk = vi.fn(() => vi.fn());
      const phase = createHandlerRegistry<TriagePhaseEvent>();
      const error = createHandlerRegistry<TriageGenerateError>();

      setForge({ generate, onChunk, onError: error.subscribe, onPhase: phase.subscribe });

      const { result } = renderHook(() => useTriageStream('FUL-77'));

      act(() => {
        phase.emit({ issueId: 'FUL-77', phase: 'triaging', commentCount: 4 });
        error.emit({ issueId: 'FUL-77', message: 'Claude CLI missing login' });
      });

      expect(result.current.phase).toBe('triaging');
      expect(result.current.commentCount).toBe(4);
    });

    it('ignores phase events for a different issue id', () => {
      const generate = vi.fn().mockResolvedValue(createBrief('FUL-77', '# generated'));
      const onChunk = vi.fn(() => vi.fn());
      const phase = createHandlerRegistry<TriagePhaseEvent>();

      setForge({ generate, onChunk, onPhase: phase.subscribe });

      const { result } = renderHook(() => useTriageStream('FUL-77'));

      act(() => {
        phase.emit({ issueId: 'FUL-99', phase: 'triaging', commentCount: 5 });
      });

      expect(result.current.phase).toBe('idle');
      expect(result.current.commentCount).toBeUndefined();
    });

    it('ignores phase events from a stale setup after issue switch', () => {
      const generate = vi.fn().mockResolvedValue(createBrief('FUL-77', '# generated'));
      const onChunk = vi.fn(() => vi.fn());
      const phase = createHandlerRegistry<TriagePhaseEvent>();

      setForge({ generate, onChunk, onPhase: phase.subscribe });

      const { result, rerender } = renderHook(({ issueId }) => useTriageStream(issueId), {
        initialProps: { issueId: 'FUL-77' as string | null },
      });

      act(() => {
        phase.emit({ issueId: 'FUL-77', phase: 'triaging', commentCount: 2 });
      });

      expect(result.current.phase).toBe('triaging');
      expect(result.current.commentCount).toBe(2);

      rerender({ issueId: 'FUL-78' });

      expect(result.current.phase).toBe('idle');
      expect(result.current.commentCount).toBeUndefined();

      act(() => {
        phase.emit({ issueId: 'FUL-77', phase: 'generating' });
      });

      expect(result.current.phase).toBe('idle');
      expect(result.current.commentCount).toBeUndefined();
    });
  });
});
