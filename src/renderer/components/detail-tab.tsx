import type { Issue } from '../../shared/types';
import { renderInlineMarkdown } from './markdown-inline';

type DetailTabProps = {
  issue: Issue;
};

export function DetailTab({ issue }: DetailTabProps) {
  if (issue.description.trim() === '') {
    return (
      <div className="drawer-empty">
        <div className="mono dim">No Linear issue description returned.</div>
      </div>
    );
  }

  const normalizedDescription = issue.description.replace(/\r\n?/g, '\n');
  const paragraphs = normalizedDescription
    .split(/\n\s*\n/)
    .map((line) => line.replace(/\n/g, ' ').trim())
    .filter(Boolean);

  return (
    <div className="detail-tab">
      <section className="md-section">
        <h3 className="md-h">Description</h3>
        <div className="md-body">
          {paragraphs.map((paragraph, index) => (
            <p key={`p-${index}`}>{renderInlineMarkdown(paragraph, `p-${index}`)}</p>
          ))}
        </div>
      </section>
    </div>
  );
}
