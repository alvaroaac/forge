import { useCallback, useEffect, useRef, useState } from 'react';

import type { Spec, SpecGenerateDone, SpecGenerateError, SpecStreamChunk } from '../../shared/types';

function toGeneratedSpec(issueId: string, content: string): Spec {
  return {
    issueId,
    content,
    generatedAt: new Date().toISOString(),
    approved: false,
  };
}

export function useSpecStream(issueId: string | null) {
  const [spec, setSpec] = useState<Spec | null>(null);
  const [streaming, setStreaming] = useState('');
  const [streamStatus, setStreamStatus] = useState<string[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const currentIssueIdRef = useRef<string | null>(null);
  const setupVersionRef = useRef(0);

  const isCurrentIssue = useCallback((targetIssueId: string): boolean => {
    return currentIssueIdRef.current === targetIssueId;
  }, []);

  const isCurrentRun = useCallback(
    (targetIssueId: string, setupVersion: number): boolean => {
      return isCurrentIssue(targetIssueId) && setupVersionRef.current === setupVersion;
    },
    [isCurrentIssue],
  );

  const resetStreamState = useCallback((): void => {
    setSpec(null);
    setStreaming('');
    setStreamStatus([]);
    setIsStreaming(false);
    setErrorMessage(null);
  }, []);

  const commitPersistedSpec = useCallback(
    (targetIssueId: string, setupVersion: number, nextSpec: Spec | null): void => {
      if (!isCurrentRun(targetIssueId, setupVersion)) {
        return;
      }

      setSpec(nextSpec);
    },
    [isCurrentRun],
  );

  const commitGeneratedSpec = useCallback(
    (targetIssueId: string, setupVersion: number, content: string): void => {
      if (!isCurrentRun(targetIssueId, setupVersion)) {
        return;
      }

      setSpec(toGeneratedSpec(targetIssueId, content));
    },
    [isCurrentRun],
  );

  const finishStreaming = useCallback(
    (targetIssueId: string, setupVersion: number): void => {
      if (!isCurrentRun(targetIssueId, setupVersion)) {
        return;
      }

      setIsStreaming(false);
    },
    [isCurrentRun],
  );

  const failStreaming = useCallback(
    (targetIssueId: string, setupVersion: number, message: string): void => {
      if (!isCurrentRun(targetIssueId, setupVersion)) {
        return;
      }

      setErrorMessage(message);
      setIsStreaming(false);
    },
    [isCurrentRun],
  );

  const handleChunk = useCallback(
    (targetIssueId: string, setupVersion: number, chunk: SpecStreamChunk): void => {
      if (chunk.issueId !== targetIssueId) {
        return;
      }

      if (!isCurrentRun(targetIssueId, setupVersion)) {
        return;
      }

      if (chunk.done) {
        setIsStreaming(false);
        return;
      }

      if (chunk.status) {
        const nextStatus = chunk.status;
        setStreamStatus((current) => {
          if (current[current.length - 1] === nextStatus) {
            return current;
          }
          return [...current, nextStatus].slice(-5);
        });
      }

      if (!chunk.delta) {
        return;
      }

      setStreaming((current) => current + chunk.delta);
    },
    [isCurrentRun],
  );

  const handleDone = useCallback(
    (targetIssueId: string, setupVersion: number, payload: SpecGenerateDone): void => {
      if (payload.issueId !== targetIssueId) {
        return;
      }

      finishStreaming(targetIssueId, setupVersion);
    },
    [finishStreaming],
  );

  const handleError = useCallback(
    (targetIssueId: string, setupVersion: number, payload: SpecGenerateError): void => {
      if (payload.issueId !== targetIssueId) {
        return;
      }

      failStreaming(targetIssueId, setupVersion, payload.message);
    },
    [failStreaming],
  );

  useEffect(() => {
    setupVersionRef.current += 1;
    const setupVersion = setupVersionRef.current;
    currentIssueIdRef.current = issueId;

    if (!issueId) {
      resetStreamState();
      return;
    }

    let cancelled = false;

    resetStreamState();

    void window.forge.spec
      .get(issueId)
      .then((nextSpec) => {
        if (cancelled) {
          return;
        }

        commitPersistedSpec(issueId, setupVersion, nextSpec);
      })
      .catch(() => {
        // Keep the default null spec when preload rejects.
      });

    const unsubscribe = window.forge.spec.onChunk((chunk: SpecStreamChunk) => {
      handleChunk(issueId, setupVersion, chunk);
    });
    const unsubscribeDone = window.forge.spec.onDone((payload: SpecGenerateDone) => {
      handleDone(issueId, setupVersion, payload);
    });
    const unsubscribeError = window.forge.spec.onError((payload: SpecGenerateError) => {
      handleError(issueId, setupVersion, payload);
    });

    return () => {
      cancelled = true;
      unsubscribe();
      unsubscribeDone();
      unsubscribeError();

      if (currentIssueIdRef.current === issueId) {
        currentIssueIdRef.current = null;
      }
    };
  }, [issueId, commitPersistedSpec, handleChunk, handleDone, handleError, resetStreamState]);

  const generate = useCallback(async (model?: string): Promise<void> => {
    if (!issueId) {
      return;
    }

    if (!isCurrentIssue(issueId)) {
      return;
    }

    const setupVersion = setupVersionRef.current;

    setStreaming('');
    setStreamStatus(['Starting Claude']);
    setIsStreaming(true);
    setErrorMessage(null);

    try {
      const result = model
        ? await window.forge.spec.generate(issueId, model)
        : await window.forge.spec.generate(issueId);
      commitGeneratedSpec(issueId, setupVersion, result.content);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (isCurrentIssue(issueId)) {
        setErrorMessage(message);
        setIsStreaming(false);
      }
    } finally {
      finishStreaming(issueId, setupVersion);
    }
  }, [issueId, commitGeneratedSpec, failStreaming, finishStreaming, isCurrentIssue]);

  return { spec, streaming, streamStatus, isStreaming, errorMessage, generate };
}
