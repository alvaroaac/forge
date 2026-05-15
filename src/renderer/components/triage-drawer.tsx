import type { Issue, TriageBrief } from '../../shared/types';

type TriageDrawerProps = {
  issue: Issue | null;
  canGenerate: boolean;
  isStreaming: boolean;
  streaming: string;
  brief: TriageBrief | null;
  errorMessage: string | null;
  onGenerate: () => void;
  onClose: () => void;
};

export function TriageDrawer({
  issue,
  canGenerate,
  isStreaming,
  streaming,
  brief,
  errorMessage,
  onGenerate,
  onClose,
}: TriageDrawerProps) {
  if (!issue) {
    return null;
  }

  const hasContent = brief?.content || streaming;

  const handleWriteClick = async (): Promise<void> => {
    const first = await window.forge.triage.write(issue.id, brief?.content ?? '');

    if (first.written) {
      return;
    }

    if (first.exists) {
      const ok = window.confirm('Overwrite existing triage-brief.md?');
      if (ok) {
        await window.forge.triage.write(issue.id, brief?.content ?? '', { overwrite: true });
      }
    }
  };

  return (
    <>
      <div className="drawer-scrim drawer-scrim-open" onClick={onClose} />
      <aside className="drawer drawer-open">
      <div className="drawer-head">
        <h2>{issue.id}</h2>
        <h3>{issue.title}</h3>
        <button className="icon-btn" type="button" onClick={onClose} title="Close" aria-label="Close">
          ✕
        </button>
      </div>
      <div className="drawer-body">
        <button
          className="btn"
          type="button"
          onClick={onGenerate}
          disabled={!canGenerate || isStreaming}
        >
          {isStreaming ? 'Generating...' : 'Generate brief'}
        </button>

        {!canGenerate ? (
          <p className="hint">Set computronRepoPath (a valid git repo) to generate a brief.</p>
        ) : null}

        {errorMessage ? <div className="error">{errorMessage}</div> : null}
        {hasContent ? <pre>{brief?.content ?? streaming}</pre> : null}

        {brief ? (
          <button className="btn" type="button" onClick={() => void handleWriteClick()}>
            Write to file
          </button>
        ) : null}
      </div>
      </aside>
    </>
  );
}
