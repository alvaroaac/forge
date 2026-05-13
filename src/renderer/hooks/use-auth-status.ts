import { useEffect, useState } from 'react';

import type { AuthStatus } from '../../shared/types';

const defaultAuthStatus: AuthStatus = {
  linear: false,
  claudeCode: false,
  codex: false,
};

export function useAuthStatus(): AuthStatus {
  const [authStatus, setAuthStatus] = useState<AuthStatus>(defaultAuthStatus);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const status = await window.forge.auth.check();

        if (!cancelled) {
          setAuthStatus(status);
        }
      } catch {
        // Keep the default auth status when preload rejects.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return authStatus;
}
