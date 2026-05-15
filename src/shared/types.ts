export type IssueStatus = 'triage' | 'todo' | 'in_progress' | 'in_review' | 'done';
export type Priority = 'urgent' | 'high' | 'medium' | 'low' | 'none';

export interface Issue {
  id: string;
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
}

export interface SpecGenerateDone {
  issueId: string;
}

export interface SpecGenerateError {
  issueId: string;
  message: string;
}

export interface TriageStreamChunk {
  issueId: string;
  delta: string;
  done: boolean;
}

export interface TriageGenerateDone {
  issueId: string;
}

export interface TriageGenerateError {
  issueId: string;
  message: string;
}

export interface TriageBrief {
  issueId: string;
  content: string;
  generatedAt: string;
}

export interface TriageWriteResult {
  issueId: string;
  path: string;
  written: boolean;
  exists: boolean;
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
