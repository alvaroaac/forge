import { useCallback, useEffect, useRef, useState } from 'react';

import type {
  GenerationPhase,
  TriageBrief,
  TriageGenerateDone,
  TriageGenerateError,
  TriagePhaseEvent,
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
  const [streamStatus, setStreamStatus] = useState<string[]>([]);
  const [isBriefPersisted, setIsBriefPersisted] = useState(false);
  const [isBriefLoading, setIsBriefLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [phase, setPhase] = useState<GenerationPhase>('idle');
  const [commentCount, setCommentCount] = useState<number | undefined>(undefined);
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
    setStreamStatus([]);
    setIsBriefPersisted(false);
    setIsBriefLoading(false);
    setIsStreaming(false);
    setErrorMessage(null);
    setPhase('idle');
    setCommentCount(undefined);
  }, []);

  const commitGeneratedBrief = useCallback(
    (targetIssueId: string, setupVersion: number, content: string): void => {
      if (!isCurrentRun(targetIssueId, setupVersion)) {
        return;
      }

      setBrief(toGeneratedBrief(targetIssueId, content));
      setIsBriefPersisted(false);
    },
    [isCurrentRun],
  );

  const finishStreaming = useCallback(
    (targetIssueId: string, setupVersion: number): void => {
      if (!isCurrentRun(targetIssueId, setupVersion)) {
        return;
      }

      setIsStreaming(false);
      setPhase('done');
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

  const handlePhase = useCallback(
    (targetIssueId: string, setupVersion: number, payload: TriagePhaseEvent): void => {
      if (payload.issueId !== targetIssueId) {
        return;
      }

      if (!isCurrentRun(targetIssueId, setupVersion)) {
        return;
      }

      setPhase(payload.phase);

      if (typeof payload.commentCount === 'number') {
        setCommentCount(payload.commentCount);
      }
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
    setIsBriefLoading(true);

    void window.forge.triage
      .get(issueId)
      .then((nextBrief) => {
        if (cancelled || !isCurrentRun(issueId, setupVersion)) {
          return;
        }

        setBrief(nextBrief);
        setIsBriefPersisted(nextBrief !== null);
      })
      .catch(() => {
        // Keep the default null brief when preload rejects.
      })
      .finally(() => {
        if (cancelled || !isCurrentRun(issueId, setupVersion)) {
          return;
        }

        setIsBriefLoading(false);
      });

    const unsubscribe = window.forge.triage.onChunk((chunk: TriageStreamChunk) => {
      handleChunk(issueId, setupVersion, chunk);
    });

    const unsubscribeDone = window.forge.triage.onDone((payload: TriageGenerateDone) => {
      handleDone(issueId, setupVersion, payload);
    });

    const unsubscribeError = window.forge.triage.onError((payload: TriageGenerateError) => {
      handleError(issueId, setupVersion, payload);
    });

    const unsubscribePhase = window.forge.triage.onPhase((payload: TriagePhaseEvent) => {
      handlePhase(issueId, setupVersion, payload);
    });

    return () => {
      cancelled = true;
      unsubscribe();
      unsubscribeDone();
      unsubscribeError();
      unsubscribePhase();

      if (currentIssueIdRef.current === issueId) {
        currentIssueIdRef.current = null;
      }
    };
  }, [issueId, handleChunk, handleDone, handleError, handlePhase, isCurrentRun, resetStreamState]);

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
      setStreamStatus(['Starting Claude']);
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
    [issueId, isCurrentIssue, commitGeneratedBrief, finishStreaming, failStreaming],
  );

  return {
    brief,
    streaming,
    streamStatus,
    isBriefPersisted,
    isBriefLoading,
    isStreaming,
    errorMessage,
    phase,
    commentCount,
    generate,
  };
}
