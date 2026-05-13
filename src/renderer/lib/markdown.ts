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
  const headings = Array.from(md.matchAll(/^##\s+(.*)$/gm));

  if (headings.length === 0) {
    return [{ h: '', body: md }];
  }

  return headings.map((match, idx) => {
    const thisMatchIndex = match.index ?? 0;
    const thisMatchText = match[0];
    const nextMatchIndex = headings[idx + 1]?.index ?? md.length;
    const body = md.slice(thisMatchIndex + thisMatchText.length, nextMatchIndex).replace(/^\n/, '');

    return {
      h: match[1]?.trim() ?? '',
      body,
    };
  });
}
