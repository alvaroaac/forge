import type { AppConfig, AuthStatus, Issue, Spec, SpecStreamChunk } from './types';

export interface ForgeApi {
  auth: {
    check: () => Promise<AuthStatus>;
  };
  linear: {
    fetch: () => Promise<Issue[]>;
    refresh: () => Promise<Issue[]>;
  };
  spec: {
    get: (issueId: string) => Promise<Spec | null>;
    generate: (issueId: string) => Promise<{ issueId: string; content: string }>;
    onChunk: (handler: (chunk: SpecStreamChunk) => void) => () => void;
  };
  config: {
    get: () => Promise<AppConfig>;
    set: (patch: Partial<AppConfig>) => Promise<void>;
  };
}

declare global {
  interface Window {
    forge: ForgeApi;
  }
}
