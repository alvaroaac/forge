import { useCallback, useEffect, useRef, useState } from 'react';

import type { Spec, SpecStreamChunk } from '../../shared/types';

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
  const [isStreaming, setIsStreaming] = useState(false);
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
    setIsStreaming(false);
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

      setStreaming((current) => current + chunk.delta);
    },
    [isCurrentRun],
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

    return () => {
      cancelled = true;
      unsubscribe();

      if (currentIssueIdRef.current === issueId) {
        currentIssueIdRef.current = null;
      }
    };
  }, [issueId, commitPersistedSpec, handleChunk, resetStreamState]);

  const generate = useCallback(async (): Promise<void> => {
    if (!issueId) {
      return;
    }

    if (!isCurrentIssue(issueId)) {
      return;
    }

    const setupVersion = setupVersionRef.current;

    setStreaming('');
    setIsStreaming(true);

    try {
      const result = await window.forge.spec.generate(issueId);
      commitGeneratedSpec(issueId, setupVersion, result.content);
    } catch {
      // Keep the default spec state when preload rejects.
    } finally {
      finishStreaming(issueId, setupVersion);
    }
  }, [issueId, commitGeneratedSpec, finishStreaming, isCurrentIssue]);

  return { spec, streaming, isStreaming, generate };
}
