import { useEffect, useState } from 'react';

import type { AppConfig } from '../../shared/types';

export function useConfig(): AppConfig | null {
  const [config, setConfig] = useState<AppConfig | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const nextConfig = await window.forge.config.get();

        if (!cancelled) {
          setConfig(nextConfig);
        }
      } catch {
        // Keep the default null config when preload rejects.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return config;
}
