import type { Issue, Spec } from '../../shared/types';
import { cleanSpecMarkdown } from '../../shared/spec-markdown';
import { splitSections } from '../lib/markdown';
import { MarkdownSection } from './markdown-section';
import { IconCheck, IconEdit, IconSpark, IconTerminal } from './icons';

const CLAUDE_MODEL_OPTIONS = ['claude-sonnet-4-6', 'sonnet', 'opus'];

type SpecTabProps = {
  issue: Issue;
  spec: Spec | null;
  streaming: string;
  isStreaming: boolean;
  errorMessage: string | null;
  claudeModel: string;
  onClaudeModelChange: (model: string) => void;
  onGenerate: () => void;
  onLaunchReview?: (content: string) => void;
  onWrite?: (content: string) => void;
  onCopy: (content: string) => void;
};

function pickContent(spec: Spec | null, streaming: string): string {
  return streaming ? streaming : (spec?.content ?? '');
}

export function SpecTab({
  issue,
  spec,
  streaming,
  isStreaming,
  errorMessage,
  claudeModel,
  onClaudeModelChange,
  onGenerate,
  onLaunchReview = () => undefined,
  onWrite = () => undefined,
  onCopy,
}: SpecTabProps) {
  const content = cleanSpecMarkdown(pickContent(spec, streaming));
  const modelOptions = CLAUDE_MODEL_OPTIONS.includes(claudeModel)
    ? CLAUDE_MODEL_OPTIONS
    : [claudeModel, ...CLAUDE_MODEL_OPTIONS];
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

  if (!content && !isStreaming) {
    return (
      <div className="drawer-empty">
        {errorMessage ? (
          <div className="mono" style={{ marginBottom: 12, color: 'var(--danger)', fontSize: 11 }}>
            {errorMessage}
          </div>
        ) : null}
        <div style={{ marginBottom: 16, color: 'var(--text-2)' }}>
          No spec yet for{' '}
          <span className="mono" style={{ color: 'var(--text-1)' }}>
            {issue.id}
          </span>
          .
        </div>
        <div style={{ marginBottom: 12 }}>{modelSelect}</div>
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
        {errorMessage ? (
          <span className="mono" style={{ color: 'var(--danger)' }}>
            · failed
          </span>
        ) : null}
        <span style={{ flex: 1 }} />
        {modelSelect}
        <div className="spec-actions">
          <button className="btn-ghost" type="button" onClick={() => onLaunchReview(content)}>
            <IconTerminal size={11} stroke={2} /> Launch Review
          </button>
          <button className="btn-ghost" type="button" onClick={() => onWrite(content)}>
            <IconEdit size={11} stroke={2} /> Write to file
          </button>
          <button className="btn-ghost" type="button" onClick={() => onCopy(content)}>
            <IconCheck size={11} stroke={2} /> Copy
          </button>
        </div>
      </div>
      {errorMessage ? (
        <div className="mono" style={{ color: 'var(--danger)', fontSize: 11, marginBottom: 10 }}>
          {errorMessage}
        </div>
      ) : null}
      <div className="spec-scroll">
        {sections.map((section, index) => (
          <MarkdownSection key={`${section.h}-${index}`} h={section.h} body={section.body} />
        ))}
      </div>
    </div>
  );
}
