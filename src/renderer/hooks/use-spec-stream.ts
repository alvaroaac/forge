import { useCallback, useEffect, useRef, useState } from 'react';

import type { Spec, SpecStreamChunk } from '../../shared/types';

export function useSpecStream(issueId: string | null) {
  const [spec, setSpec] = useState<Spec | null>(null);
  const [streaming, setStreaming] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const currentIssueIdRef = useRef<string | null>(null);
  const setupVersionRef = useRef(0);

  useEffect(() => {
    setupVersionRef.current += 1;
    const setupVersion = setupVersionRef.current;
    currentIssueIdRef.current = issueId;

    if (!issueId) {
      setSpec(null);
      setStreaming('');
      setIsStreaming(false);
      return;
    }

    let cancelled = false;

    setSpec(null);
    setStreaming('');
    setIsStreaming(false);

    void window.forge.spec
      .get(issueId)
      .then((nextSpec) => {
        if (cancelled) {
          return;
        }

        if (setupVersionRef.current !== setupVersion) {
          return;
        }

        if (currentIssueIdRef.current !== issueId) {
          return;
        }

        setSpec(nextSpec);
      })
      .catch(() => {
        // Keep the default null spec when preload rejects.
      });

    const unsubscribe = window.forge.spec.onChunk((chunk: SpecStreamChunk) => {
      if (chunk.issueId !== issueId) {
        return;
      }

      if (setupVersionRef.current !== setupVersion) {
        return;
      }

      if (currentIssueIdRef.current !== issueId) {
        return;
      }

      if (chunk.done) {
        setIsStreaming(false);
        return;
      }

      setStreaming((current) => current + chunk.delta);
    });

    return () => {
      cancelled = true;
      unsubscribe();

      if (currentIssueIdRef.current === issueId) {
        currentIssueIdRef.current = null;
      }
    };
  }, [issueId]);

  const generate = useCallback(async (): Promise<void> => {
    if (!issueId) {
      return;
    }

    if (currentIssueIdRef.current !== issueId) {
      return;
    }

    const setupVersion = setupVersionRef.current;

    setStreaming('');
    setIsStreaming(true);

    try {
      const result = await window.forge.spec.generate(issueId);

      if (setupVersionRef.current !== setupVersion) {
        return;
      }

      if (currentIssueIdRef.current !== issueId) {
        return;
      }

      setSpec({
        issueId,
        content: result.content,
        generatedAt: new Date().toISOString(),
        approved: false,
      });
    } catch {
      // Keep the default spec state when preload rejects.
    } finally {
      if (setupVersionRef.current === setupVersion && currentIssueIdRef.current === issueId) {
        setIsStreaming(false);
      }
    }
  }, [issueId]);

  return { spec, streaming, isStreaming, generate };
}
