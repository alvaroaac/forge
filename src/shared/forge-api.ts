import type {
  AppConfig,
  AuthStatus,
  Issue,
  Spec,
  SpecGenerateDone,
  SpecGenerateError,
  SpecPhaseEvent,
  SpecStreamChunk,
  TriageBrief,
  TriageGenerateDone,
  TriageGenerateError,
  TriagePhaseEvent,
  TriageStreamChunk,
  TriageWriteResult,
  SpecReviewResult,
} from './types';

export interface ForgeApi {
  auth: {
    check: () => Promise<AuthStatus>;
  };
  linear: {
    fetch: () => Promise<Issue[]>;
    fetchIssueDetail: (issueId: string) => Promise<Issue | null>;
    refresh: () => Promise<Issue[]>;
    fetchTeamTriage: () => Promise<Issue[]>;
    getViewerId: () => Promise<string>;
  };
  spec: {
    get: (issueId: string) => Promise<Spec | null>;
    generate: (issueId: string, model?: string) => Promise<{ issueId: string; content: string }>;
    write: (issueId: string, content: string) => Promise<{ issueId: string; content: string }>;
    launchReview: (issueId: string, content: string, model: string) => Promise<SpecReviewResult>;
    onChunk: (handler: (chunk: SpecStreamChunk) => void) => () => void;
    onDone: (handler: (payload: SpecGenerateDone) => void) => () => void;
    onError: (handler: (payload: SpecGenerateError) => void) => () => void;
    onPhase: (handler: (event: SpecPhaseEvent) => void) => () => void;
  };
  triage: {
    get: (issueId: string) => Promise<TriageBrief | null>;
    generate: (issueId: string, model?: string) => Promise<TriageBrief>;
    write: (
      issueId: string,
      content: string,
      opts?: { overwrite?: boolean },
    ) => Promise<TriageWriteResult>;
    onChunk: (handler: (chunk: TriageStreamChunk) => void) => () => void;
    onDone: (handler: (payload: TriageGenerateDone) => void) => () => void;
    onError: (handler: (payload: TriageGenerateError) => void) => () => void;
    onPhase: (handler: (event: TriagePhaseEvent) => void) => () => void;
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
