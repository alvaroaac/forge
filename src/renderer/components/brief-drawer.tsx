import { useEffect, useState } from 'react';

import type { GenerationPhase, Issue, GeneratedBrief } from '../../shared/types';
import { CommentsTab } from './comments-tab';
import { DetailTab } from './detail-tab';
import { GeneratedDocument } from './generated-document';
import { IssueDrawerShell } from './issue-drawer-shell';

type WriteState = 'idle' | 'saving' | 'saved';
export type BriefDrawerTab = 'detail' | 'comments' | 'brief';

type BriefDrawerProps = {
  issue: Issue | null;
  tab?: BriefDrawerTab;
  setTab?: (tab: BriefDrawerTab) => void;
  canGenerate: boolean;
  isStreaming: boolean;
  streaming: string;
  streamStatus?: string[];
  phase?: GenerationPhase;
  commentCount?: number;
  isBriefPersisted?: boolean;
  isBriefLoading?: boolean;
  brief: GeneratedBrief | null;
  errorMessage: string | null;
  onGenerate: () => void;
  onClose: () => void;
};

type GenerateButtonProps = Pick<BriefDrawerProps, 'canGenerate' | 'isStreaming' | 'onGenerate'>;

type BriefActionsProps = GenerateButtonProps & {
  brief: GeneratedBrief | null;
  content: string;
  isInitiallySaved: boolean;
  onWrite: () => Promise<boolean> | boolean;
};

function pickBriefContent(brief: GeneratedBrief | null, streaming: string): string {
  return streaming ? streaming : (brief?.content ?? '');
}

function pickStreamStatus(streamStatus?: string[]): string[] {
  return streamStatus ?? [];
}

function pickPhaseStatus(phase?: GenerationPhase, commentCount?: number): string | null {
  if (phase === 'triaging') {
    if (commentCount === 0) {
      return 'No comments to triage';
    }

    return `Triaging ${commentCount ?? '…'} comment(s)…`;
  }

  if (phase === 'generating') {
    return 'Generating brief…';
  }

  return null;
}

function pickActivityStatus(
  streamStatus?: string[],
  phase?: GenerationPhase,
  commentCount?: number,
): string[] {
  const statuses = pickStreamStatus(streamStatus);
  const phaseStatus = pickPhaseStatus(phase, commentCount);

  if (!phaseStatus) {
    return statuses;
  }

  return [...statuses, phaseStatus];
}

async function writeBriefWithOverwrite(issueId: string, content: string): Promise<boolean> {
  const first = await window.forge.brief.write(issueId, content);

  if (first.written) {
    return true;
  }

  if (!first.exists) {
    return false;
  }

  if (!window.confirm('Overwrite existing brief.md?')) {
    return false;
  }

  const second = await window.forge.brief.write(issueId, content, { overwrite: true });
  return second.written;
}

function GenerateBriefButton({ canGenerate, isStreaming, onGenerate }: GenerateButtonProps) {
  return (
    <button
      className="btn-ghost btn-ghost-accent"
      type="button"
      onClick={onGenerate}
      disabled={!canGenerate || isStreaming}
    >
      Generate Brief
    </button>
  );
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

function BriefActions({
  brief,
  content,
  isInitiallySaved,
  canGenerate,
  isStreaming,
  onGenerate,
  onWrite,
}: BriefActionsProps) {
  const [writeState, setWriteState] = useState<WriteState>(isInitiallySaved ? 'saved' : 'idle');
  const isWriteDisabled = writeState !== 'idle';

  useEffect(() => {
    setWriteState(isInitiallySaved ? 'saved' : 'idle');
  }, [content, isInitiallySaved]);

  const handleWriteClick = async (): Promise<void> => {
    setWriteState('saving');

    try {
      const didWrite = await onWrite();
      setWriteState(didWrite ? 'saved' : 'idle');
    } catch {
      setWriteState('idle');
    }
  };

  return (
    <>
      <GenerateBriefButton
        canGenerate={canGenerate}
        isStreaming={isStreaming}
        onGenerate={onGenerate}
      />
      {brief ? (
        <button
          className="btn-ghost"
          type="button"
          disabled={isWriteDisabled}
          onClick={() => void handleWriteClick()}
        >
          {pickWriteLabel(writeState)}
        </button>
      ) : null}
    </>
  );
}

function BriefConfigHint({ canGenerate }: Pick<BriefDrawerProps, 'canGenerate'>) {
  if (canGenerate) {
    return null;
  }

  return <p className="hint">Set computronRepoPath (a valid git repo) to generate a brief.</p>;
}

export function BriefDrawer({
  issue,
  tab = 'detail',
  setTab = () => undefined,
  canGenerate,
  isStreaming,
  streaming,
  streamStatus = [],
  phase,
  commentCount,
  isBriefPersisted = false,
  isBriefLoading = false,
  brief,
  errorMessage,
  onGenerate,
  onClose,
}: BriefDrawerProps) {
  if (!issue) {
    return null;
  }

  const content = pickBriefContent(brief, streaming);
  const isCheckingBrief = isBriefLoading && !content;
  const handleWriteClick = async (): Promise<boolean> => {
    return writeBriefWithOverwrite(issue.id, content);
  };
  const generateButton = (
    <GenerateBriefButton
      canGenerate={canGenerate}
      isStreaming={isStreaming}
      onGenerate={onGenerate}
    />
  );
  const actions = (
    <BriefActions
      brief={brief}
      content={content}
      isInitiallySaved={isBriefPersisted}
      canGenerate={canGenerate}
      isStreaming={isStreaming}
      onGenerate={onGenerate}
      onWrite={handleWriteClick}
    />
  );

  return (
    <IssueDrawerShell
      issue={issue}
      onClose={onClose}
      closeTitle="Close"
      closeAriaLabel="Close"
      renderClosedShell={false}
      tabs={[
        {
          key: 'detail',
          label: 'Details',
          isActive: tab === 'detail',
          onClick: () => setTab('detail'),
        },
        {
          key: 'comments',
          label: 'Comments',
          isActive: tab === 'comments',
          onClick: () => setTab('comments'),
        },
        {
          key: 'brief',
          label: 'Brief',
          isActive: tab === 'brief',
          onClick: () => setTab('brief'),
        },
      ]}
    >
      <BriefConfigHint canGenerate={canGenerate} />
      {tab === 'detail' ? <DetailTab issue={issue} /> : null}
      {tab === 'comments' ? <CommentsTab issue={issue} /> : null}
      {tab === 'brief' ? (
        <GeneratedDocument
          artifactName="Brief"
          artifactPath={`thoughts/tasks/${issue.id}/brief.md`}
          content={content}
          isStreaming={isStreaming || isCheckingBrief}
          streamStatus={
            isCheckingBrief
              ? ['Checking brief.md']
              : pickActivityStatus(streamStatus, phase, commentCount)
          }
          errorMessage={errorMessage}
          emptyTitle={`No brief yet for ${issue.id}.`}
          activityTitle={isCheckingBrief ? 'Loading brief' : 'Generating brief'}
          activityStatusFallback="Starting brief"
          actions={isCheckingBrief ? null : actions}
          emptyActions={isCheckingBrief ? null : generateButton}
        />
      ) : null}
    </IssueDrawerShell>
  );
}
