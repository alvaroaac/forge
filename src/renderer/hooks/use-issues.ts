import { useCallback, useEffect, useRef, useState } from 'react';

import type { Issue } from '../../shared/types';

const POLL_MS = 60_000;

export function useIssues() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [lastSync, setLastSync] = useState<number>(0);
  const isActiveRef = useRef(true);
  const refreshIdRef = useRef(0);

  const loadAll = useCallback(async (): Promise<Issue[]> => {
    const [assignedIssues, triageIssues] = await Promise.all([
      window.forge.linear.refresh(),
      window.forge.linear.fetchTeamTriage(),
    ]);

    const merged = new Map<string, Issue>();
    for (const issue of assignedIssues) {
      merged.set(issue.id, issue);
    }
    for (const issue of triageIssues) {
      merged.set(issue.id, issue);
    }

    return [...merged.values()];
  }, []);

  const refresh = useCallback(async (): Promise<void> => {
    const refreshId = refreshIdRef.current + 1;
    refreshIdRef.current = refreshId;

    try {
      const nextIssues = await loadAll();

      if (!isActiveRef.current || refreshId !== refreshIdRef.current) {
        return;
      }

      setIssues(nextIssues);
      setLastSync(Date.now());
    } catch {
      // Keep the current issues and sync timestamp when preload rejects.
    }
  }, []);

  useEffect(() => {
    isActiveRef.current = true;

    let cancelled = false;

    const syncOnMount = async () => {
      try {
        const cachedIssues = await window.forge.linear.fetch();

        if (cancelled || !isActiveRef.current) {
          return;
        }

        setIssues(cachedIssues);
        void refresh();
      } catch {
        // Keep the default empty issues list when preload rejects.
      }
    };

    void syncOnMount();

    const intervalId = window.setInterval(() => {
      void refresh();
    }, POLL_MS);

    return () => {
      cancelled = true;
      isActiveRef.current = false;
      window.clearInterval(intervalId);
    };
  }, [refresh]);

  return { issues, lastSync, refresh };
}
