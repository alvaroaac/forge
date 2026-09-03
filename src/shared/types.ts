export type IssueStatus = 'triage' | 'todo' | 'in_progress' | 'in_review' | 'done';
export type Priority = 'urgent' | 'high' | 'medium' | 'low' | 'none';

export interface Issue {
  id: string;
  uuid: string;
  title: string;
  description: string;
  status: IssueStatus;
  priority: Priority;
  labels: string[];
  url: string;
  updatedAt: string;
  isBug: boolean;
  assigneeId: string | null;
}

export interface CommentThread {
  blockAnchor: string;
  comments: string[];
}

export interface Spec {
  issueId: string;
  content: string;
  generatedAt: string;
  approved: boolean;
  comments?: CommentThread[];
}

export interface AppConfig {
  linearTokenPath: string;
  linearTeamKey: string;
  repoPath: string;
  computronRepoPath: string;
  claudeModel: string;
}

export interface AuthStatus {
  linear: boolean;
  claudeCode: boolean;
  codex: boolean;
  computron: boolean;
}

export interface SpecStreamChunk {
  issueId: string;
  delta: string;
  done: boolean;
  status?: string;
}

export interface SpecGenerateDone {
  issueId: string;
}

export interface SpecGenerateError {
  issueId: string;
  message: string;
}

export interface BriefStreamChunk {
  issueId: string;
  delta: string;
  done: boolean;
  status?: string;
}

export interface BriefGenerateDone {
  issueId: string;
}

export interface BriefGenerateError {
  issueId: string;
  message: string;
}

export interface GeneratedBrief {
  issueId: string;
  content: string;
  generatedAt: string;
}

export interface BriefWriteResult {
  issueId: string;
  path: string;
  written: boolean;
  exists: boolean;
}

export interface CommentSummaryComment {
  id: string;
  body: string;
  createdAt: string;
  authorName: string;
  isBot: boolean;
}

export interface CommentSummaryResult {
  issueId: string;
  comments: CommentSummaryComment[];
  commentCount: number;
  summary: string;
  skippedReason?: 'missing-uuid' | 'no-comments';
  errorMessage?: string;
}

export interface CommentFetchResult {
  issueId: string;
  comments: CommentSummaryComment[];
  commentCount: number;
  skippedReason?: 'missing-uuid' | 'no-comments';
  errorMessage?: string;
}

export interface SpecReviewSummary {
  verdict: 'approved' | 'changes_requested';
  reviewerSummary: string;
  commentCount: number;
  appliedChanges: string[];
  unresolvedComments: string[];
}

export interface SpecReviewResult {
  content: string;
  summary: SpecReviewSummary;
}

export type GenerationPhase = 'idle' | 'triaging' | 'generating' | 'done';

export interface SpecPhaseEvent {
  issueId: string;
  phase: 'triaging' | 'generating';
  commentCount?: number;
}

export interface BriefPhaseEvent {
  issueId: string;
  phase: 'triaging' | 'generating';
  commentCount?: number;
}
