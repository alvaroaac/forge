import { useEffect, useState } from 'react';

import type { AppConfig } from '../../shared/types';

export function useConfig(): AppConfig | null {
  const [config, setConfig] = useState<AppConfig | null>(null);

  useEffect(() => {
    let cancelled = false;

    void window.forge.config.get().then((nextConfig) => {
      if (!cancelled) {
        setConfig(nextConfig);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return config;
}
