import { useEffect, useState } from 'react';

import type { Issue, TriageBrief } from '../../shared/types';
import { GeneratedDocument } from './generated-document';
import { IssueDrawerShell } from './issue-drawer-shell';

type WriteState = 'idle' | 'saving' | 'saved';

type TriageDrawerProps = {
  issue: Issue | null;
  canGenerate: boolean;
  isStreaming: boolean;
  streaming: string;
  streamStatus?: string[];
  isBriefPersisted?: boolean;
  isBriefLoading?: boolean;
  brief: TriageBrief | null;
  errorMessage: string | null;
  onGenerate: () => void;
  onClose: () => void;
};

type GenerateButtonProps = Pick<TriageDrawerProps, 'canGenerate' | 'isStreaming' | 'onGenerate'>;

type TriageActionsProps = GenerateButtonProps & {
  brief: TriageBrief | null;
  content: string;
  isInitiallySaved: boolean;
  onWrite: () => Promise<void> | void;
};

function pickBriefContent(brief: TriageBrief | null, streaming: string): string {
  return streaming ? streaming : (brief?.content ?? '');
}

async function writeBriefWithOverwrite(issueId: string, content: string): Promise<void> {
  const first = await window.forge.triage.write(issueId, content);

  if (first.written) {
    return;
  }

  if (!first.exists) {
    return;
  }

  if (!window.confirm('Overwrite existing triage-brief.md?')) {
    return;
  }

  await window.forge.triage.write(issueId, content, { overwrite: true });
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

function TriageActions({
  brief,
  content,
  isInitiallySaved,
  canGenerate,
  isStreaming,
  onGenerate,
  onWrite,
}: TriageActionsProps) {
  const [writeState, setWriteState] = useState<WriteState>(isInitiallySaved ? 'saved' : 'idle');
  const isWriteDisabled = writeState !== 'idle';

  useEffect(() => {
    setWriteState(isInitiallySaved ? 'saved' : 'idle');
  }, [content, isInitiallySaved]);

  const handleWriteClick = async (): Promise<void> => {
    setWriteState('saving');

    try {
      await onWrite();
      setWriteState('saved');
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

function TriageConfigHint({ canGenerate }: Pick<TriageDrawerProps, 'canGenerate'>) {
  if (canGenerate) {
    return null;
  }

  return <p className="hint">Set computronRepoPath (a valid git repo) to generate a brief.</p>;
}

export function TriageDrawer({
  issue,
  canGenerate,
  isStreaming,
  streaming,
  streamStatus = [],
  isBriefPersisted = false,
  isBriefLoading = false,
  brief,
  errorMessage,
  onGenerate,
  onClose,
}: TriageDrawerProps) {
  if (!issue) {
    return null;
  }

  const content = pickBriefContent(brief, streaming);
  const isCheckingBrief = isBriefLoading && !content;
  const handleWriteClick = async (): Promise<void> => {
    await writeBriefWithOverwrite(issue.id, pickBriefContent(brief, ''));
  };
  const generateButton = (
    <GenerateBriefButton
      canGenerate={canGenerate}
      isStreaming={isStreaming}
      onGenerate={onGenerate}
    />
  );
  const actions = (
    <TriageActions
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
    >
      <TriageConfigHint canGenerate={canGenerate} />
      <GeneratedDocument
        artifactName="Brief"
        artifactPath={`thoughts/tasks/${issue.id}/triage-brief.md`}
        content={content}
        isStreaming={isStreaming || isCheckingBrief}
        streamStatus={isCheckingBrief ? ['Checking triage-brief.md'] : streamStatus}
        errorMessage={errorMessage}
        emptyTitle={`No brief yet for ${issue.id}.`}
        activityTitle={isCheckingBrief ? 'Loading brief' : 'Generating brief'}
        activityStatusFallback="Starting brief"
        actions={isCheckingBrief ? null : actions}
        emptyActions={isCheckingBrief ? null : generateButton}
      />
    </IssueDrawerShell>
  );
}
