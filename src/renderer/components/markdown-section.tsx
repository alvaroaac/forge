import { renderInlineMarkdown } from './markdown-inline';

type MarkdownSectionProps = {
  h: string;
  body: string;
};

const BULLET_RE = /^[•\-*]\s+/;
const NUMBERED_RE = /^(\d+)\.\s+/;

type LineKind = 'paragraph' | 'bullet' | 'numbered';

function getLineKind(line: string): LineKind {
  if (BULLET_RE.test(line)) return 'bullet';
  if (NUMBERED_RE.test(line)) return 'numbered';
  return 'paragraph';
}

function renderListItems(lines: string[], startIndex: number, kind: 'bullet' | 'numbered') {
  const items: JSX.Element[] = [];
  let index = startIndex;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();
    const nextKind = getLineKind(trimmed);
    if (!trimmed || nextKind !== kind) break;

    if (kind === 'bullet') {
      const text = trimmed.replace(BULLET_RE, '');
      items.push(
        <li key={index} className="md-li">
          <span className="md-li-mark mono">•</span>
          <span>{renderInlineMarkdown(text, index)}</span>
        </li>,
      );
    } else {
      const match = trimmed.match(NUMBERED_RE);
      const mark = `${match?.[1]}.`;
      const text = trimmed.replace(NUMBERED_RE, '');
      items.push(
        <li key={index} className="md-li">
          <span className="md-li-mark mono">{mark}</span>
          <span>{renderInlineMarkdown(text, index)}</span>
        </li>,
      );
    }

    index += 1;
  }

  return { items, nextIndex: index };
}

function renderBody(lines: string[]) {
  const output: JSX.Element[] = [];
  let i = 0;
  let blockKey = 0;

  while (i < lines.length) {
    const trimmed = lines[i].trim();
    if (!trimmed) {
      i += 1;
      continue;
    }

    const kind = getLineKind(trimmed);
    if (kind === 'paragraph') {
      output.push(<p key={`p-${blockKey++}`}>{renderInlineMarkdown(trimmed, blockKey)}</p>);
      i += 1;
      continue;
    }

    const ListTag = kind === 'bullet' ? 'ul' : 'ol';
    const { items, nextIndex } = renderListItems(lines, i, kind);
    output.push(
      <ListTag
        key={`list-${blockKey++}`}
        className="md-list"
        style={{ margin: 0, padding: 0, listStyle: 'none' }}
      >
        {items}
      </ListTag>,
    );
    i = nextIndex;
  }

  return output;
}

export function MarkdownSection({ h, body }: MarkdownSectionProps) {
  const lines = body.split('\n');

  return (
    <section className="md-section">
      {h ? <h3 className="md-h">{h}</h3> : null}
      <div className="md-body">{renderBody(lines)}</div>
    </section>
  );
}
