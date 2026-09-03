import type {
  AppConfig,
  AuthStatus,
  Issue,
  Spec,
  SpecGenerateDone,
  SpecGenerateError,
  SpecPhaseEvent,
  SpecStreamChunk,
  GeneratedBrief,
  BriefGenerateDone,
  BriefGenerateError,
  BriefPhaseEvent,
  BriefStreamChunk,
  BriefWriteResult,
  SpecReviewResult,
  CommentFetchResult,
  CommentSummaryResult,
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
  brief: {
    get: (issueId: string) => Promise<GeneratedBrief | null>;
    generate: (issueId: string, model?: string) => Promise<GeneratedBrief>;
    write: (
      issueId: string,
      content: string,
      opts?: { overwrite?: boolean },
    ) => Promise<BriefWriteResult>;
    onChunk: (handler: (chunk: BriefStreamChunk) => void) => () => void;
    onDone: (handler: (payload: BriefGenerateDone) => void) => () => void;
    onError: (handler: (payload: BriefGenerateError) => void) => () => void;
    onPhase: (handler: (event: BriefPhaseEvent) => void) => () => void;
  };
  comments?: {
    fetch: (issueId: string) => Promise<CommentFetchResult>;
    generateSummary: (issueId: string) => Promise<CommentSummaryResult>;
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
