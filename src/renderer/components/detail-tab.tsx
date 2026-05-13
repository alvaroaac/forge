import type { Issue } from '../../shared/types';
import { inlineParts } from '../lib/markdown';

type DetailTabProps = {
  issue: Issue;
};

function renderInline(line: string, keyPrefix: string) {
  return inlineParts(line).map((part, index) => {
    if (part.type === 'code') {
      return (
        <code key={`${keyPrefix}-${index}`} className="md-code">
          {part.text}
        </code>
      );
    }

    if (part.type === 'ref') {
      return (
        <span key={`${keyPrefix}-${index}`} className="md-ref">
          {part.text}
        </span>
      );
    }

    if (part.type === 'mention') {
      return (
        <span key={`${keyPrefix}-${index}`} className="md-mention">
          {part.text}
        </span>
      );
    }

    return part.text;
  });
}

export function DetailTab({ issue }: DetailTabProps) {
  if (issue.description.trim() === '') {
    return (
      <div className="drawer-empty">
        <div className="mono dim">No description from Linear.</div>
      </div>
    );
  }

  const paragraphs = issue.description
    .split('\n\n')
    .map((line) => line.replace(/\n/g, ' ').trim())
    .filter(Boolean);

  return (
    <div className="detail-tab">
      <section className="md-section">
        <h3 className="md-h">Description</h3>
        <div className="md-body">
          {paragraphs.map((paragraph, index) => (
            <p key={`p-${index}`}>{renderInline(paragraph, `p-${index}`)}</p>
          ))}
        </div>
      </section>
    </div>
  );
}
