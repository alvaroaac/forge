export type IssueStatus = 'todo' | 'in_progress' | 'in_review' | 'done';
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
  claudeModel: string;
}

export interface AuthStatus {
  linear: boolean;
  claudeCode: boolean;
  codex: boolean;
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
