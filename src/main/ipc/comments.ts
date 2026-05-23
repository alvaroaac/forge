import type { IpcMain } from 'electron';
import { IpcChannel } from '../../shared/ipc-channels';
import type { CommentFetchResult, CommentSummaryResult, Issue } from '../../shared/types';
import { isSafeIssueId } from '../lib/issue-id';
import type { IssuesCache } from '../services/issues-cache';
import type { LinearComment } from '../services/comment-fetcher';

type CommentsGeneratePayload = {
  issueId: string;
  issue?: Issue;
  comments?: LinearComment[];
};

type FetchAndFilterCommentsFn = (issueUuid: string) => Promise<LinearComment[]>;
type TriageCommentsFn = (input: {
  issueTitle: string;
  issueDescription: string;
  comments: LinearComment[];
}) => Promise<string>;

export interface CommentsGenerateSummaryDeps {
  cache: Pick<IssuesCache, 'read'>;
  fetchAndFilterComments: FetchAndFilterCommentsFn;
  triageComments: TriageCommentsFn;
}

export type CommentsFetchDeps = Omit<CommentsGenerateSummaryDeps, 'triageComments'>;

function isPayloadIssue(issue: Issue | undefined, issueId: string): issue is Issue {
  return Boolean(issue && issue.id === issueId && isSafeIssueId(issue.id));
}

function findIssue(issues: Issue[], payload: CommentsGeneratePayload): Issue {
  if (isPayloadIssue(payload.issue, payload.issueId)) {
    return payload.issue;
  }

  const { issueId } = payload;
  if (!isSafeIssueId(issueId)) {
    throw new Error(`Issue not found in cache: ${issueId}`);
  }

  const issue = issues.find((candidate) => candidate.id === issueId);
  if (!issue) {
    throw new Error(`Issue not found in cache: ${issueId}`);
  }

  return issue;
}

function emptyResult(
  issueId: string,
  skippedReason: CommentSummaryResult['skippedReason'],
): CommentSummaryResult {
  return {
    issueId,
    comments: [],
    commentCount: 0,
    summary: '',
    skippedReason,
  };
}

function emptyFetchResult(
  issueId: string,
  skippedReason: CommentFetchResult['skippedReason'],
): CommentFetchResult {
  return {
    issueId,
    comments: [],
    commentCount: 0,
    skippedReason,
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function registerCommentsFetchHandler(ipc: IpcMain, deps: CommentsFetchDeps): void {
  ipc.handle(
    IpcChannel.CommentsFetch,
    async (_event, payload: CommentsGeneratePayload): Promise<CommentFetchResult> => {
      const issues = await deps.cache.read();
      const issue = findIssue(issues, payload);

      if (!issue.uuid) {
        return emptyFetchResult(payload.issueId, 'missing-uuid');
      }

      const comments = await deps.fetchAndFilterComments(issue.uuid);
      if (comments.length === 0) {
        return emptyFetchResult(payload.issueId, 'no-comments');
      }

      return {
        issueId: payload.issueId,
        comments,
        commentCount: comments.length,
      };
    },
  );
}

export function registerCommentsGenerateSummaryHandler(
  ipc: IpcMain,
  deps: CommentsGenerateSummaryDeps,
): void {
  ipc.handle(
    IpcChannel.CommentsGenerateSummary,
    async (_event, payload: CommentsGeneratePayload): Promise<CommentSummaryResult> => {
      const issues = await deps.cache.read();
      const issue = findIssue(issues, payload);

      if (!issue.uuid) {
        return emptyResult(payload.issueId, 'missing-uuid');
      }

      const comments = payload.comments ?? (await deps.fetchAndFilterComments(issue.uuid));
      if (comments.length === 0) {
        return emptyResult(payload.issueId, 'no-comments');
      }

      try {
        const summary = await deps.triageComments({
          issueTitle: issue.title,
          issueDescription: issue.description,
          comments,
        });
        return {
          issueId: payload.issueId,
          comments,
          commentCount: comments.length,
          summary,
        };
      } catch (error) {
        return {
          issueId: payload.issueId,
          comments,
          commentCount: comments.length,
          summary: '',
          errorMessage: errorMessage(error),
        };
      }
    },
  );
}
