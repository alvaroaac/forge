import type { Issue } from '../../shared/types';
import type { LinearComment } from '../services/comment-fetcher';

export type FetchAndFilterCommentsFn = (issueUuid: string) => Promise<LinearComment[]>;

export type TriageCommentsFn = (input: {
  issueTitle: string;
  issueDescription: string;
  comments: LinearComment[];
}) => Promise<string>;

type EmitCommentContextPhaseFn = (payload: {
  issueId: string;
  phase: 'triaging';
  commentCount: number;
}) => void;

export type CommentContextDeps = {
  fetchAndFilterComments: FetchAndFilterCommentsFn;
  triageComments: TriageCommentsFn;
};

export type CurateIssueCommentContextInput = {
  deps: CommentContextDeps;
  issue: Issue;
  emitPhase: EmitCommentContextPhaseFn;
  logPrefix: string;
};

export async function curateIssueCommentContext({
  deps,
  issue,
  emitPhase,
  logPrefix,
}: CurateIssueCommentContextInput): Promise<string> {
  if (!issue.uuid) {
    return '';
  }

  try {
    const comments = await deps.fetchAndFilterComments(issue.uuid);
    emitPhase({
      issueId: issue.id,
      phase: 'triaging',
      commentCount: comments.length,
    });

    if (comments.length === 0) {
      return '';
    }

    return await deps.triageComments({
      issueTitle: issue.title,
      issueDescription: issue.description,
      comments,
    });
  } catch (err) {
    console.warn(`${logPrefix} comment context failed, proceeding without curated comments:`, err);
    return '';
  }
}
