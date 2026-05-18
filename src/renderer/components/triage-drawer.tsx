import type { Issue, TriageBrief } from '../../shared/types';
import { GeneratedDocument } from './generated-document';
import { IssueDrawerShell } from './issue-drawer-shell';

type TriageDrawerProps = {
  issue: Issue | null;
  canGenerate: boolean;
  isStreaming: boolean;
  streaming: string;
  streamStatus?: string[];
  brief: TriageBrief | null;
  errorMessage: string | null;
  onGenerate: () => void;
  onClose: () => void;
};

type GenerateButtonProps = Pick<TriageDrawerProps, 'canGenerate' | 'isStreaming' | 'onGenerate'>;

type TriageActionsProps = GenerateButtonProps & {
  brief: TriageBrief | null;
  onWrite: () => void;
};

function pickBriefContent(brief: TriageBrief | null, streaming: string): string {
  return brief?.content ?? streaming;
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

function TriageActions({ brief, canGenerate, isStreaming, onGenerate, onWrite }: TriageActionsProps) {
  return (
    <>
      <GenerateBriefButton
        canGenerate={canGenerate}
        isStreaming={isStreaming}
        onGenerate={onGenerate}
      />
      {brief ? (
        <button className="btn-ghost" type="button" onClick={onWrite}>
          Write to file
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
  brief,
  errorMessage,
  onGenerate,
  onClose,
}: TriageDrawerProps) {
  if (!issue) {
    return null;
  }

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
      canGenerate={canGenerate}
      isStreaming={isStreaming}
      onGenerate={onGenerate}
      onWrite={() => void handleWriteClick()}
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
        content={pickBriefContent(brief, streaming)}
        isStreaming={isStreaming}
        streamStatus={streamStatus}
        errorMessage={errorMessage}
        emptyTitle={`No brief yet for ${issue.id}.`}
        activityTitle="Generating brief"
        activityStatusFallback="Starting brief"
        actions={actions}
        emptyActions={generateButton}
      />
    </IssueDrawerShell>
  );
}
