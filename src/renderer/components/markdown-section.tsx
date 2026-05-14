import { renderInlineMarkdown } from './markdown-inline';

type MarkdownSectionProps = {
  h: string;
  body: string;
};

const BULLET_RE = /^[•\-*]\s+/;
const NUMBERED_RE = /^(\d+)\.\s+/;
const BLOCKQUOTE_RE = /^>\s?/;
const HEADING_RE = /^(#{1,6})\s+(.+)$/;
const RULE_RE = /^-{3,}$/;
const FENCE_RE = /^```/;

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

    if (FENCE_RE.test(trimmed)) {
      i += 1;
      continue;
    }

    if (RULE_RE.test(trimmed)) {
      output.push(<hr key={`rule-${blockKey++}`} className="md-rule" />);
      i += 1;
      continue;
    }

    const heading = trimmed.match(HEADING_RE);
    if (heading) {
      output.push(
        <h4 key={`title-${blockKey++}`} className="md-title">
          {renderInlineMarkdown(heading[2] ?? '', blockKey)}
        </h4>,
      );
      i += 1;
      continue;
    }

    if (BLOCKQUOTE_RE.test(trimmed)) {
      const text = trimmed.replace(BLOCKQUOTE_RE, '');
      output.push(
        <blockquote key={`quote-${blockKey++}`} className="md-quote">
          {renderInlineMarkdown(text, blockKey)}
        </blockquote>,
      );
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
