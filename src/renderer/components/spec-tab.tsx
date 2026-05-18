import { useEffect, useState } from 'react';

import type { Issue, Spec, SpecReviewSummary } from '../../shared/types';
import { cleanSpecMarkdown } from '../../shared/spec-markdown';
import { GeneratedDocument } from './generated-document';
import { IconCheck, IconEdit, IconSpark, IconTerminal } from './icons';

const CLAUDE_MODEL_OPTIONS = ['claude-sonnet-4-6', 'sonnet', 'opus'];

const noopContentHandler = () => undefined;
type WriteState = 'idle' | 'saving' | 'saved';

type SpecTabProps = {
  issue: Issue;
  spec: Spec | null;
  streaming: string;
  streamStatus?: string[];
  isSpecPersisted?: boolean;
  reviewedContent?: string | null;
  reviewSummary?: SpecReviewSummary | null;
  isReviewPending?: boolean;
  reviewStatusMessage?: string | null;
  reviewErrorMessage?: string | null;
  isStreaming: boolean;
  errorMessage: string | null;
  claudeModel: string;
  onClaudeModelChange: (model: string) => void;
  onGenerate: () => void;
  onLaunchReview?: (content: string) => void;
  onWrite?: (content: string) => Promise<void> | void;
  onCopy: (content: string) => void;
};

function pickContent(spec: Spec | null, streaming: string): string {
  return streaming ? streaming : (spec?.content ?? '');
}

function pickDisplayedContent(
  spec: Spec | null,
  streaming: string,
  reviewedContent: string | null,
): string {
  if (reviewedContent) {
    return reviewedContent;
  }

  return pickContent(spec, streaming);
}

function pickReviewStatus(isReviewPending?: boolean, reviewStatusMessage?: string | null): string | null {
  return isReviewPending ? 'Review in progress...' : (reviewStatusMessage ?? null);
}

function pickModelOptions(claudeModel: string): string[] {
  if (CLAUDE_MODEL_OPTIONS.includes(claudeModel)) {
    return CLAUDE_MODEL_OPTIONS;
  }

  return [claudeModel, ...CLAUDE_MODEL_OPTIONS];
}

function pickContentHandler(handler?: (content: string) => void): (content: string) => void {
  return handler ?? noopContentHandler;
}

function pickWriteLabel(writeState: WriteState): string {
  if (writeState === 'saving') {
    return 'Writing...';
  }

  if (writeState === 'saved') {
    return 'Saved to file';
  }

  return 'Write to file';
}

function pickReviewedContent(reviewedContent?: string | null): string | null {
  return reviewedContent ?? null;
}

function pickErrorMessage(
  errorMessage: string | null,
  reviewErrorMessage?: string | null,
): string | null {
  return reviewErrorMessage ?? errorMessage;
}

function pickStreamStatus(streamStatus?: string[]): string[] {
  return streamStatus ?? [];
}

function pickIsReviewPending(isReviewPending?: boolean): boolean {
  return isReviewPending ?? false;
}

function pickReviewSummary(reviewSummary?: SpecReviewSummary | null): SpecReviewSummary | null {
  return reviewSummary ?? null;
}

function SpecEmptyTitle({ issueId }: { issueId: string }) {
  return (
    <>
      No spec yet for{' '}
      <span className="mono" style={{ color: 'var(--text-1)' }}>
        {issueId}
      </span>
      .
    </>
  );
}

function SpecActions({
  content,
  isInitiallySaved,
  isReviewPending,
  onLaunchReview,
  onWrite,
  onCopy,
}: Required<Pick<SpecTabProps, 'onLaunchReview' | 'onWrite' | 'onCopy'>> &
  Pick<SpecTabProps, 'isReviewPending'> & {
  content: string;
  isInitiallySaved: boolean;
}) {
  const [writeState, setWriteState] = useState<WriteState>(
    isInitiallySaved ? 'saved' : 'idle',
  );
  const isWriteDisabled = writeState !== 'idle';

  useEffect(() => {
    setWriteState(isInitiallySaved ? 'saved' : 'idle');
  }, [content, isInitiallySaved]);

  const handleWriteClick = async (): Promise<void> => {
    setWriteState('saving');

    try {
      await onWrite(content);
      setWriteState('saved');
    } catch {
      setWriteState('idle');
    }
  };

  return (
    <>
      <button
        className="btn-ghost"
        type="button"
        disabled={isReviewPending}
        onClick={() => onLaunchReview(content)}
      >
        <IconTerminal size={11} stroke={2} /> Launch Review
      </button>
      <button
        className="btn-ghost"
        type="button"
        disabled={isWriteDisabled}
        onClick={() => void handleWriteClick()}
      >
        <IconEdit size={11} stroke={2} /> {pickWriteLabel(writeState)}
      </button>
      <button className="btn-ghost" type="button" onClick={() => onCopy(content)}>
        <IconCheck size={11} stroke={2} /> Copy
      </button>
    </>
  );
}

function SpecReviewChanges({
  issueId,
  reviewSummary,
}: {
  issueId: string;
  reviewSummary: SpecReviewSummary | null;
}) {
  const [showReviewChanges, setShowReviewChanges] = useState(false);
  const reviewChangesId = `review-changes-${issueId}`;

  useEffect(() => {
    setShowReviewChanges(false);
  }, [reviewSummary]);

  if (!reviewSummary) {
    return null;
  }

  return (
    <div style={{ marginTop: 12 }}>
      <button
        aria-controls={reviewChangesId}
        aria-expanded={showReviewChanges}
        className="btn-ghost"
        type="button"
        onClick={() => setShowReviewChanges((current) => !current)}
      >
        Review changes
      </button>
      {showReviewChanges ? (
        <div id={reviewChangesId} style={{ marginTop: 10, fontSize: 12 }}>
          <div>
            <strong>Verdict:</strong> {reviewSummary.verdict}
          </div>
          <div>
            <strong>Reviewer summary:</strong> {reviewSummary.reviewerSummary}
          </div>
          <div>
            <strong>Comment count:</strong> {reviewSummary.commentCount}
          </div>
          <div style={{ marginTop: 8 }}>
            <strong>Applied changes:</strong>
            <ul>
              {reviewSummary.appliedChanges.map((change) => (
                <li key={change}>{change}</li>
              ))}
            </ul>
          </div>
          <div style={{ marginTop: 8 }}>
            <strong>Unresolved comments:</strong>
            <ul>
              {reviewSummary.unresolvedComments.map((comment) => (
                <li key={comment}>{comment}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function SpecTab({
  issue,
  spec,
  streaming,
  streamStatus,
  isSpecPersisted = false,
  reviewedContent,
  reviewSummary,
  isReviewPending,
  reviewStatusMessage,
  reviewErrorMessage,
  isStreaming,
  errorMessage,
  claudeModel,
  onClaudeModelChange,
  onGenerate,
  onLaunchReview,
  onWrite,
  onCopy,
}: SpecTabProps) {
  const content = cleanSpecMarkdown(pickDisplayedContent(spec, streaming, pickReviewedContent(reviewedContent)));
  const isDisplayedSpecPersisted = isSpecPersisted && !streaming && !pickReviewedContent(reviewedContent);
  const combinedErrorMessage = pickErrorMessage(errorMessage, reviewErrorMessage);
  const effectiveReviewStatus = pickReviewStatus(isReviewPending, reviewStatusMessage);
  const modelOptions = pickModelOptions(claudeModel);
  const launchReview = pickContentHandler(onLaunchReview);
  const writeSpec = pickContentHandler(onWrite);

  const modelSelect = (
    <label className="model-picker">
      <span className="mono dim">Model</span>
      <select
        className="model-select"
        aria-label="Spec generation model"
        value={claudeModel}
        onChange={(event) => onClaudeModelChange(event.target.value)}
      >
        {modelOptions.map((model) => (
          <option key={model} value={model}>
            {model}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <>
      <GeneratedDocument
        artifactPath={`thoughts/tasks/${issue.id}/initial-spec.md`}
        content={content}
        isStreaming={isStreaming}
        streamStatus={pickStreamStatus(streamStatus)}
        errorMessage={combinedErrorMessage}
        statusMessage={effectiveReviewStatus}
        emptyTitle={<SpecEmptyTitle issueId={issue.id} />}
        activityTitle="Generating spec"
        activityStatusFallback="Starting Claude"
        actions={
          <>
            {modelSelect}
            <SpecActions
              content={content}
              isInitiallySaved={isDisplayedSpecPersisted}
              isReviewPending={pickIsReviewPending(isReviewPending)}
              onLaunchReview={launchReview}
              onWrite={writeSpec}
              onCopy={onCopy}
            />
          </>
        }
        emptyActions={
          <>
            <div style={{ marginBottom: 12 }}>{modelSelect}</div>
            <button className="btn-primary" type="button" onClick={onGenerate}>
              <IconSpark size={12} stroke={2} /> Generate Spec
            </button>
            <div className="mono dim" style={{ marginTop: 14, fontSize: 11 }}>
              reads AGENTS.md + thoughts/ + Linear issue
            </div>
          </>
        }
      />
      <SpecReviewChanges issueId={issue.id} reviewSummary={pickReviewSummary(reviewSummary)} />
    </>
  );
}
