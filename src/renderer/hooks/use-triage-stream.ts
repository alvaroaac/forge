import { useCallback, useEffect, useRef, useState } from 'react';

import type {
  TriageBrief,
  TriageGenerateDone,
  TriageGenerateError,
  TriageStreamChunk,
} from '../../shared/types';

function toGeneratedBrief(issueId: string, content: string): TriageBrief {
  return {
    issueId,
    content,
    generatedAt: new Date().toISOString(),
  };
}

export function useTriageStream(issueId: string | null) {
  const [brief, setBrief] = useState<TriageBrief | null>(null);
  const [streaming, setStreaming] = useState('');
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
    setBrief(null);
    setStreaming('');
    setIsStreaming(false);
    setErrorMessage(null);
  }, []);

  const commitGeneratedBrief = useCallback(
    (targetIssueId: string, setupVersion: number, content: string): void => {
      if (!isCurrentRun(targetIssueId, setupVersion)) {
        return;
      }

      setBrief(toGeneratedBrief(targetIssueId, content));
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
    (targetIssueId: string, setupVersion: number, chunk: TriageStreamChunk): void => {
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

  const handleDone = useCallback(
    (targetIssueId: string, setupVersion: number, payload: TriageGenerateDone): void => {
      if (payload.issueId !== targetIssueId) {
        return;
      }

      finishStreaming(targetIssueId, setupVersion);
    },
    [finishStreaming],
  );

  const handleError = useCallback(
    (targetIssueId: string, setupVersion: number, payload: TriageGenerateError): void => {
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

    resetStreamState();

    const unsubscribe = window.forge.triage.onChunk((chunk: TriageStreamChunk) => {
      handleChunk(issueId, setupVersion, chunk);
    });

    const unsubscribeDone = window.forge.triage.onDone((payload: TriageGenerateDone) => {
      handleDone(issueId, setupVersion, payload);
    });

    const unsubscribeError = window.forge.triage.onError((payload: TriageGenerateError) => {
      handleError(issueId, setupVersion, payload);
    });

    return () => {
      unsubscribe();
      unsubscribeDone();
      unsubscribeError();

      if (currentIssueIdRef.current === issueId) {
        currentIssueIdRef.current = null;
      }
    };
  }, [issueId, handleChunk, handleDone, handleError, resetStreamState]);

  const generate = useCallback(
    async (model?: string): Promise<void> => {
      if (!issueId) {
        return;
      }

      if (!isCurrentIssue(issueId)) {
        return;
      }

      const setupVersion = setupVersionRef.current;

      setStreaming('');
      setIsStreaming(true);
      setErrorMessage(null);

      try {
        const result = model
          ? await window.forge.triage.generate(issueId, model)
          : await window.forge.triage.generate(issueId);

        commitGeneratedBrief(issueId, setupVersion, result.content);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failStreaming(issueId, setupVersion, message);
      } finally {
        finishStreaming(issueId, setupVersion);
      }
    },
    [issueId, commitGeneratedBrief, finishStreaming, failStreaming],
  );

  return { brief, streaming, isStreaming, errorMessage, generate };
}
