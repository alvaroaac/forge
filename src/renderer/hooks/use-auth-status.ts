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

    void window.forge.auth.check().then((status) => {
      if (!cancelled) {
        setAuthStatus(status);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return authStatus;
}
