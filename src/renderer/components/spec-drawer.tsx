import type { GenerationPhase, Issue, Spec, SpecReviewSummary } from '../../shared/types';
import { DetailTab } from './detail-tab';
import { IssueDrawerShell } from './issue-drawer-shell';
import { SpecTab } from './spec-tab';

export type DrawerTab = 'detail' | 'spec';

type SpecDrawerProps = {
  issue: Issue | null;
  tab: DrawerTab;
  setTab: (tab: DrawerTab) => void;
  onClose: () => void;
  spec: Spec | null;
  streaming: string;
  streamStatus?: string[];
  phase?: GenerationPhase;
  commentCount?: number;
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

type SpecDrawerBodyProps = Omit<SpecDrawerProps, 'setTab' | 'onClose'>;

function getStreamStatus(streamStatus: string[] | undefined): string[] {
  return streamStatus ?? [];
}

function getReviewedContent(reviewedContent: string | null | undefined): string | null {
  return reviewedContent ?? null;
}

function getReviewSummary(
  reviewSummary: SpecReviewSummary | null | undefined,
): SpecReviewSummary | null {
  return reviewSummary ?? null;
}

function getOptionalMessage(message: string | null | undefined): string | null {
  return message ?? null;
}

function getOptionalBoolean(value: boolean | undefined): boolean {
  return value === true;
}

function SpecDrawerBody({
  issue,
  tab,
  spec,
  streaming,
  streamStatus,
  phase,
  commentCount,
  isSpecPersisted,
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
}: SpecDrawerBodyProps) {
  if (!issue) {
    return null;
  }

  if (tab === 'detail') {
    return <DetailTab issue={issue} />;
  }

  return (
    <SpecTab
      issue={issue}
      spec={spec}
      streaming={streaming}
      streamStatus={getStreamStatus(streamStatus)}
      phase={phase}
      commentCount={commentCount}
      isSpecPersisted={getOptionalBoolean(isSpecPersisted)}
      reviewedContent={getReviewedContent(reviewedContent)}
      reviewSummary={getReviewSummary(reviewSummary)}
      isReviewPending={getOptionalBoolean(isReviewPending)}
      reviewStatusMessage={getOptionalMessage(reviewStatusMessage)}
      reviewErrorMessage={getOptionalMessage(reviewErrorMessage)}
      isStreaming={isStreaming}
      errorMessage={errorMessage}
      claudeModel={claudeModel}
      onClaudeModelChange={onClaudeModelChange}
      onGenerate={onGenerate}
      onLaunchReview={onLaunchReview}
      onWrite={onWrite}
      onCopy={onCopy}
    />
  );
}

export function SpecDrawer({
  issue,
  tab,
  setTab,
  onClose,
  spec,
  streaming,
  streamStatus,
  phase,
  commentCount,
  isSpecPersisted,
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
}: SpecDrawerProps) {
  return (
    <IssueDrawerShell
      issue={issue}
      onClose={onClose}
      closeTitle="Close (Esc)"
      closeOnEscape={true}
      tabs={[
        {
          key: 'detail',
          label: 'Detail',
          isActive: tab === 'detail',
          onClick: () => setTab('detail'),
        },
        { key: 'spec', label: 'Spec', isActive: tab === 'spec', onClick: () => setTab('spec') },
      ]}
    >
      <SpecDrawerBody
        issue={issue}
        tab={tab}
        spec={spec}
        streaming={streaming}
        streamStatus={streamStatus}
        phase={phase}
        commentCount={commentCount}
        isSpecPersisted={isSpecPersisted}
        reviewedContent={reviewedContent}
        reviewSummary={reviewSummary}
        isReviewPending={isReviewPending}
        reviewStatusMessage={reviewStatusMessage}
        reviewErrorMessage={reviewErrorMessage}
        isStreaming={isStreaming}
        errorMessage={errorMessage}
        claudeModel={claudeModel}
        onClaudeModelChange={onClaudeModelChange}
        onGenerate={onGenerate}
        onLaunchReview={onLaunchReview}
        onWrite={onWrite}
        onCopy={onCopy}
      />
    </IssueDrawerShell>
  );
}
