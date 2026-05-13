import type { Issue, Spec } from '../../shared/types';
import { splitSections } from '../lib/markdown';
import { MarkdownSection } from './markdown-section';
import { IconCheck, IconSpark } from './icons';

type SpecTabProps = {
  issue: Issue;
  spec: Spec | null;
  streaming: string;
  isStreaming: boolean;
  onGenerate: () => void;
  onCopy: (content: string) => void;
};

function pickContent(spec: Spec | null, streaming: string): string {
  return streaming ? streaming : spec?.content ?? '';
}

export function SpecTab({ issue, spec, streaming, isStreaming, onGenerate, onCopy }: SpecTabProps) {
  const content = pickContent(spec, streaming);

  if (!content && !isStreaming) {
    return (
      <div className="drawer-empty">
        <div style={{ marginBottom: 16, color: 'var(--text-2)' }}>
          No spec yet for{' '}
          <span className="mono" style={{ color: 'var(--text-1)' }}>
            {issue.id}
          </span>
          .
        </div>
        <button className="btn-primary" type="button" onClick={onGenerate}>
          <IconSpark size={12} stroke={2} /> Generate Spec
        </button>
        <div className="mono dim" style={{ marginTop: 14, fontSize: 11 }}>
          reads AGENTS.md + thoughts/ + Linear issue
        </div>
      </div>
    );
  }

  const sections = splitSections(content);

  return (
    <div className="spec-tab">
      <div className="spec-meta-strip">
        <span className="mono dim">thoughts/tasks/{issue.id}/initial-spec.md</span>
        {isStreaming ? <span className="mono dim">· streaming…</span> : null}
        <span style={{ flex: 1 }} />
        <button className="btn-ghost" type="button" onClick={() => onCopy(content)}>
          <IconCheck size={11} stroke={2} /> Copy
        </button>
      </div>
      <div className="spec-scroll">
        {sections.map((section, index) => (
          <MarkdownSection key={`${section.h}-${index}`} h={section.h} body={section.body} />
        ))}
      </div>
    </div>
  );
}
