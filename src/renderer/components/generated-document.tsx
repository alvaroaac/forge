import type { ReactNode } from 'react';

import { splitSections } from '../lib/markdown';
import { MarkdownSection } from './markdown-section';

type GeneratedDocumentProps = {
  artifactName?: ReactNode;
  artifactPath: string;
  content: string;
  isStreaming: boolean;
  streamStatus?: string[];
  errorMessage?: string | null;
  statusMessage?: string | null;
  emptyTitle: ReactNode;
  emptyDescription?: ReactNode;
  activityTitle: string;
  activityStatusFallback: string;
  actions?: ReactNode;
  emptyActions?: ReactNode;
};

type ActivityProps = {
  title: string;
  currentStatus: string;
  priorStatuses: string[];
};

type EmptyStateProps = {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
};

type MetaStripProps = Pick<
  GeneratedDocumentProps,
  'artifactName' | 'artifactPath' | 'isStreaming' | 'errorMessage' | 'actions'
> & {
  hasContent: boolean;
};

type MessageStackProps = Pick<GeneratedDocumentProps, 'errorMessage' | 'statusMessage'>;

type ActionSlotProps = Pick<GeneratedDocumentProps, 'actions'> & {
  shouldRenderActions: boolean;
};

type ArtifactNameProps = Pick<GeneratedDocumentProps, 'artifactName'>;

type DocumentBodyProps = Pick<
  GeneratedDocumentProps,
  | 'content'
  | 'isStreaming'
  | 'streamStatus'
  | 'emptyTitle'
  | 'emptyDescription'
  | 'activityTitle'
  | 'activityStatusFallback'
  | 'emptyActions'
> & {
  hasContent: boolean;
};

function hasDocumentContent(content: string): boolean {
  return content.trim().length > 0;
}

function currentStatus(statuses: string[], fallback: string): string {
  return statuses[statuses.length - 1] ?? fallback;
}

function priorStatuses(statuses: string[]): string[] {
  return statuses.slice(0, -1);
}

function GeneratedDocumentActionSlot({ actions, shouldRenderActions }: ActionSlotProps) {
  if (!shouldRenderActions || !actions) {
    return null;
  }

  return <div className="spec-actions">{actions}</div>;
}

function GeneratedDocumentArtifactName({ artifactName }: ArtifactNameProps) {
  if (!artifactName) {
    return null;
  }

  return <span className="mono">{artifactName}</span>;
}

function GeneratedDocumentMetaStrip({
  artifactName,
  artifactPath,
  isStreaming,
  errorMessage,
  actions,
  hasContent,
}: MetaStripProps) {
  const shouldRenderActions = hasContent || isStreaming;

  return (
    <div className="spec-meta-strip">
      <GeneratedDocumentArtifactName artifactName={artifactName} />
      <span className="mono dim">{artifactPath}</span>
      {isStreaming ? <span className="mono dim">· streaming…</span> : null}
      {errorMessage ? (
        <span className="mono" style={{ color: 'var(--danger)' }}>
          · failed
        </span>
      ) : null}
      <span style={{ flex: 1 }} />
      <GeneratedDocumentActionSlot actions={actions} shouldRenderActions={shouldRenderActions} />
    </div>
  );
}

function GeneratedDocumentMessages({ errorMessage, statusMessage }: MessageStackProps) {
  return (
    <>
      {errorMessage ? (
        <div className="mono" style={{ color: 'var(--danger)', fontSize: 11, margin: '10px 22px' }}>
          {errorMessage}
        </div>
      ) : null}
      {statusMessage ? (
        <div className="mono dim" style={{ fontSize: 11, margin: '10px 22px' }}>
          {statusMessage}
        </div>
      ) : null}
    </>
  );
}

function StreamSpinner() {
  return <span className="stream-spinner" aria-hidden="true" />;
}

function GeneratedDocumentActivity({ title, currentStatus, priorStatuses }: ActivityProps) {
  return (
    <div className="spec-activity" role="status" aria-live="polite">
      <div className="spec-activity-head">
        <StreamSpinner />
        <div>
          <div className="spec-activity-title">{title}</div>
          <div className="mono dim">{currentStatus}</div>
        </div>
      </div>
      {priorStatuses.length > 0 ? (
        <ul className="spec-activity-list">
          {priorStatuses.map((status) => (
            <li key={status}>{status}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function GeneratedDocumentEmpty({ title, description, actions }: EmptyStateProps) {
  return (
    <div className="drawer-empty">
      <div style={{ marginBottom: description ? 8 : 16, color: 'var(--text-2)' }}>{title}</div>
      {description ? (
        <div className="mono dim" style={{ marginBottom: 16, fontSize: 11 }}>
          {description}
        </div>
      ) : null}
      {actions}
    </div>
  );
}

function GeneratedDocumentMarkdown({
  content,
  isStreaming,
}: Pick<GeneratedDocumentProps, 'content' | 'isStreaming'>) {
  const sections = splitSections(content);

  return (
    <div className="spec-scroll">
      {sections.map((section, index) => (
        <MarkdownSection key={`${section.h}-${index}`} h={section.h} body={section.body} />
      ))}
      {isStreaming ? (
        <div className="stream-spinner-row" role="status" aria-live="polite">
          <StreamSpinner />
        </div>
      ) : null}
    </div>
  );
}

function GeneratedDocumentBody({
  content,
  isStreaming,
  streamStatus = [],
  emptyTitle,
  emptyDescription,
  activityTitle,
  activityStatusFallback,
  emptyActions,
  hasContent,
}: DocumentBodyProps) {
  if (hasContent) {
    return <GeneratedDocumentMarkdown content={content} isStreaming={isStreaming} />;
  }

  if (isStreaming) {
    return (
      <GeneratedDocumentActivity
        title={activityTitle}
        currentStatus={currentStatus(streamStatus, activityStatusFallback)}
        priorStatuses={priorStatuses(streamStatus)}
      />
    );
  }

  return (
    <GeneratedDocumentEmpty
      title={emptyTitle}
      description={emptyDescription}
      actions={emptyActions}
    />
  );
}

export function GeneratedDocument({
  artifactName,
  artifactPath,
  content,
  isStreaming,
  streamStatus = [],
  errorMessage = null,
  statusMessage = null,
  emptyTitle,
  emptyDescription,
  activityTitle,
  activityStatusFallback,
  actions,
  emptyActions,
}: GeneratedDocumentProps) {
  const hasContent = hasDocumentContent(content);

  return (
    <div className="spec-tab generated-document">
      <GeneratedDocumentMetaStrip
        artifactName={artifactName}
        artifactPath={artifactPath}
        isStreaming={isStreaming}
        errorMessage={errorMessage}
        actions={actions}
        hasContent={hasContent}
      />
      <GeneratedDocumentMessages errorMessage={errorMessage} statusMessage={statusMessage} />
      <GeneratedDocumentBody
        content={content}
        isStreaming={isStreaming}
        streamStatus={streamStatus}
        emptyTitle={emptyTitle}
        emptyDescription={emptyDescription}
        activityTitle={activityTitle}
        activityStatusFallback={activityStatusFallback}
        emptyActions={emptyActions}
        hasContent={hasContent}
      />
    </div>
  );
}
