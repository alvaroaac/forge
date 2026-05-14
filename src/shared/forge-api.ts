import type {
  AppConfig,
  AuthStatus,
  Issue,
  Spec,
  SpecReviewResult,
  SpecGenerateDone,
  SpecGenerateError,
  SpecStreamChunk,
} from './types';

export interface ForgeApi {
  auth: {
    check: () => Promise<AuthStatus>;
  };
  linear: {
    fetch: () => Promise<Issue[]>;
    fetchIssueDetail: (issueId: string) => Promise<Issue | null>;
    refresh: () => Promise<Issue[]>;
  };
  spec: {
    get: (issueId: string) => Promise<Spec | null>;
    generate: (issueId: string, model?: string) => Promise<{ issueId: string; content: string }>;
    write: (issueId: string, content: string) => Promise<{ issueId: string; content: string }>;
    launchReview: (issueId: string, content: string, model: string) => Promise<SpecReviewResult>;
    onChunk: (handler: (chunk: SpecStreamChunk) => void) => () => void;
    onDone: (handler: (payload: SpecGenerateDone) => void) => () => void;
    onError: (handler: (payload: SpecGenerateError) => void) => () => void;
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
