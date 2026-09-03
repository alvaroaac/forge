import { useEffect, useRef, useState } from 'react';

import type { CommentFetchResult, CommentSummaryResult, Issue } from '../../shared/types';
import { GeneratedDocument } from './generated-document';

type CommentsTabProps = {
  issue: Issue;
};

type FetchState = 'checking' | 'loaded' | 'error';
type SummaryState = 'idle' | 'loading' | 'loaded' | 'error';

function formatCommentTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function commentStatus(result: CommentFetchResult | CommentSummaryResult | null): string | null {
  if (!result?.skippedReason) {
    return null;
  }

  if (result.skippedReason === 'missing-uuid') {
    return 'Comments cannot be fetched for this cached issue yet.';
  }

  return 'No human comments found for this issue.';
}

export function CommentsTab({ issue }: CommentsTabProps) {
  const currentIssueIdRef = useRef(issue.id);
  const [commentsResult, setCommentsResult] = useState<CommentFetchResult | null>(null);
  const [summaryResult, setSummaryResult] = useState<CommentSummaryResult | null>(null);
  const [fetchState, setFetchState] = useState<FetchState>('checking');
  const [summaryState, setSummaryState] = useState<SummaryState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    currentIssueIdRef.current = issue.id;

    setCommentsResult(null);
    setSummaryResult(null);
    setFetchState('checking');
    setSummaryState('idle');
    setErrorMessage(null);

    const fetchComments = async (): Promise<void> => {
      try {
        if (!window.forge.comments) {
          throw new Error('Comments API is unavailable');
        }

        const nextResult = await window.forge.comments.fetch(issue.id);
        if (cancelled) {
          return;
        }

        setCommentsResult(nextResult);
        setFetchState('loaded');
        setErrorMessage(nextResult.errorMessage ?? null);
      } catch (error) {
        if (cancelled) {
          return;
        }

        setFetchState('error');
        setErrorMessage(error instanceof Error ? error.message : 'Comment fetch failed');
      }
    };

    void fetchComments();

    return () => {
      cancelled = true;
    };
  }, [issue]);

  const handleGenerateClick = async (): Promise<void> => {
    const requestIssueId = issue.id;
    const comments = commentsResult?.comments ?? [];
    if (comments.length === 0) {
      return;
    }

    setSummaryState('loading');
    setErrorMessage(null);

    try {
      if (!window.forge.comments) {
        throw new Error('Comments API is unavailable');
      }

      const nextResult = await window.forge.comments.generateSummary(requestIssueId);
      if (currentIssueIdRef.current !== requestIssueId || nextResult.issueId !== requestIssueId) {
        return;
      }

      setSummaryResult(nextResult);
      setCommentsResult({
        issueId: nextResult.issueId,
        comments: nextResult.comments,
        commentCount: nextResult.commentCount,
        skippedReason: nextResult.skippedReason,
        errorMessage: nextResult.errorMessage,
      });
      setSummaryState('loaded');
      setErrorMessage(nextResult.errorMessage ?? null);
    } catch (error) {
      if (currentIssueIdRef.current !== requestIssueId) {
        return;
      }

      setSummaryState('error');
      setErrorMessage(error instanceof Error ? error.message : 'Comment summary failed');
    }
  };

  const isChecking = fetchState === 'checking';
  const isGenerating = summaryState === 'loading';
  const comments = commentsResult?.comments ?? [];
  const skippedMessage = commentStatus(commentsResult);
  const canGenerate = fetchState === 'loaded' && comments.length > 0 && !isGenerating;
  const buttonLabel = isChecking
    ? 'Checking comments...'
    : isGenerating
      ? 'Generating...'
      : comments.length === 0
        ? 'No comments to summarize'
        : 'Generate Comment Summary';

  return (
    <div className="comments-tab">
      <div className="spec-meta-strip">
        <span className="mono">Comments</span>
        <span className="mono dim">{issue.id}</span>
        <span style={{ flex: 1 }} />
        <div className="spec-actions">
          <button
            className="btn-ghost btn-ghost-accent"
            type="button"
            disabled={!canGenerate}
            onClick={() => void handleGenerateClick()}
          >
            {buttonLabel}
          </button>
        </div>
      </div>
      <GeneratedDocument
        artifactName="Comment summary"
        artifactPath={`Linear comments/${issue.id}`}
        content={summaryResult?.summary ?? ''}
        isStreaming={isChecking || isGenerating}
        streamStatus={
          isChecking
            ? ['Checking Linear comments']
            : isGenerating
              ? ['Generating comment summary']
              : []
        }
        errorMessage={fetchState === 'error' || summaryState === 'error' ? errorMessage : null}
        statusMessage={
          fetchState === 'loaded' || summaryState === 'loaded'
            ? (skippedMessage ?? errorMessage)
            : null
        }
        emptyTitle="No comment summary generated yet."
        emptyDescription="Generate one from the current Linear comments."
        activityTitle={isChecking ? 'Checking comments' : 'Generating comment summary'}
        activityStatusFallback="Reading Linear comments"
      />
      <section className="comments-raw">
        <div className="comments-raw-head">
          <h3 className="md-h">Raw filtered comments</h3>
          {commentsResult ? (
            <span className="mono dim">{commentsResult.commentCount} comment(s)</span>
          ) : null}
        </div>
        {comments.length > 0 ? (
          <div className="comments">
            {comments.map((comment) => (
              <article className="comment" key={comment.id}>
                <div className="comment-head">
                  <strong className="comment-author">{comment.authorName}</strong>
                  <span className="mono dim">{formatCommentTime(comment.createdAt)}</span>
                </div>
                <div className="comment-body">{comment.body}</div>
              </article>
            ))}
          </div>
        ) : (
          <p className="mono dim">
            {isChecking ? 'Checking Linear comments...' : 'No raw comments to show.'}
          </p>
        )}
      </section>
    </div>
  );
}
