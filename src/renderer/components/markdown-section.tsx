import { highlightInline } from '../lib/markdown';

type MarkdownSectionProps = {
  h: string;
  body: string;
};

const BULLET_RE = /^[•\-*]\s+/;
const NUMBERED_RE = /^(\d+)\.\s+/;

function renderLine(line: string, key: number) {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const isBullet = BULLET_RE.test(trimmed);
  const isNum = NUMBERED_RE.test(trimmed);
  if (!isBullet && !isNum) {
    return <p key={key} dangerouslySetInnerHTML={{ __html: highlightInline(trimmed) }} />;
  }

  const mark = isNum ? `${trimmed.match(NUMBERED_RE)?.[1]}.` : '•';
  const text = trimmed.replace(BULLET_RE, '').replace(NUMBERED_RE, '');

  return (
    <li key={key} className="md-li">
      <span className="md-li-mark mono">{mark}</span>
      <span dangerouslySetInnerHTML={{ __html: highlightInline(text) }} />
    </li>
  );
}

export function MarkdownSection({ h, body }: MarkdownSectionProps) {
  const lines = body.split('\n');

  return (
    <section className="md-section">
      {h ? <h3 className="md-h">{h}</h3> : null}
      <div className="md-body">{lines.map(renderLine)}</div>
    </section>
  );
}
