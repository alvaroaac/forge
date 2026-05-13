export interface Section {
  h: string;
  body: string;
}

const BACKTICK_RE = /`([^`]+)`/g;
const REF_RE = /(§\d+(?:\.\d+)?)/g;
const MENTION_RE = /@(\w+)/g;

export function highlightInline(s: string): string {
  return s
    .replace(BACKTICK_RE, '<code class="md-code">$1</code>')
    .replace(REF_RE, '<span class="md-ref">$1</span>')
    .replace(MENTION_RE, '<span class="md-mention">@$1</span>');
}

export function splitSections(md: string): Section[] {
  const lines = md.split('\n');
  const sections: Section[] = [];
  let current: Section = { h: '', body: '' };

  for (const line of lines) {
    const m = /^##\s+(.*)$/.exec(line);
    if (m) {
      if (current.h || current.body) sections.push(current);
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
