export interface Section {
  h: string;
  body: string;
}

type InlineTokenType = 'text' | 'code' | 'ref' | 'mention';

export type InlineToken = {
  type: InlineTokenType;
  text: string;
};

const BACKTICK_RE = /`([^`]+)`/g;
const REF_RE = /(§\d+(?:\.\d+)?)/g;
const MENTION_RE = /@(\w+)/g;
const INLINE_TOKEN_RE = /`([^`]+)`|(§\d+(?:\.\d+)?)|@(\w+)/g;

export function highlightInline(s: string): string {
  return s
    .replace(BACKTICK_RE, '<code class="md-code">$1</code>')
    .replace(REF_RE, '<span class="md-ref">$1</span>')
    .replace(MENTION_RE, '<span class="md-mention">@$1</span>');
}

export function inlineParts(s: string): InlineToken[] {
  const parts: InlineToken[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  INLINE_TOKEN_RE.lastIndex = 0;

  while ((match = INLINE_TOKEN_RE.exec(s)) !== null) {
    const [matchedText, code, ref, mention] = match;
    if (match.index > last) {
      parts.push({ type: 'text', text: s.slice(last, match.index) });
    }

    if (code !== undefined) {
      parts.push({ type: 'code', text: code });
    } else if (ref !== undefined) {
      parts.push({ type: 'ref', text: ref });
    } else if (mention !== undefined) {
      parts.push({ type: 'mention', text: `@${mention}` });
    } else if (matchedText.length > 0) {
      parts.push({ type: 'text', text: matchedText });
    }

    last = INLINE_TOKEN_RE.lastIndex;
  }

  if (last < s.length) {
    parts.push({ type: 'text', text: s.slice(last) });
  }

  return parts.length ? parts : [{ type: 'text', text: s }];
}

export function splitSections(md: string): Section[] {
  const lines = md.replace(/\r\n?/g, '\n').split('\n');
  const sections: Section[] = [];
  let current: Section = { h: '', body: '' };

  for (const line of lines) {
    const m = /^##\s+(.*)$/.exec(line);
    if (m) {
      if (current.h || current.body.trim()) sections.push(current);
      current = { h: m[1] ?? '', body: '' };
      continue;
    }
    current.body += (current.body ? '\n' : '') + line;
  }

  if (current.h || current.body.trim()) sections.push(current);

  return sections.length ? sections.map(trimBody) : [{ h: '', body: md }];
}

function trimBody(s: Section): Section {
  return { h: s.h, body: s.body.trim() };
}
