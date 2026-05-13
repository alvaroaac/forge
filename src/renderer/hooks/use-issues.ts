import { useCallback, useEffect, useRef, useState } from 'react';

import type { Issue } from '../../shared/types';

const POLL_MS = 60_000;

export function useIssues() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [lastSync, setLastSync] = useState<number>(0);
  const isActiveRef = useRef(true);

  const refresh = useCallback(async (): Promise<void> => {
    try {
      const nextIssues = await window.forge.linear.refresh();

      if (!isActiveRef.current) {
        return;
      }

      setIssues(nextIssues);
      setLastSync(Date.now());
    } catch {
      // Keep the current issues and sync timestamp when preload rejects.
    }
  }, []);

  useEffect(() => {
    const syncOnMount = async () => {
      try {
        const cachedIssues = await window.forge.linear.fetch();

        if (!isActiveRef.current) {
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
      isActiveRef.current = false;
      window.clearInterval(intervalId);
    };
  }, [refresh]);

  return { issues, lastSync, refresh };
}
