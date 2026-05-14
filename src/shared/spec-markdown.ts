const SPEC_HEADING_RE = /^#\s*Spec:/m;
const MARKDOWN_FENCE_RE = /```(?:markdown|md)?\s*\n?([\s\S]*?)\n?```/i;

function looksLikeSpec(content: string): boolean {
  return SPEC_HEADING_RE.test(content) || /^##\s+Task Summary/m.test(content);
}

export function cleanSpecMarkdown(raw: string): string {
  let content = raw.replace(/\r\n?/g, '\n').trim();
  const fenced = content.match(MARKDOWN_FENCE_RE);

  if (fenced?.[1] && looksLikeSpec(fenced[1])) {
    content = fenced[1].trim();
  }

  const specHeadingIndex = content.search(SPEC_HEADING_RE);
  if (specHeadingIndex > 0) {
    content = content.slice(specHeadingIndex).trim();
  }

  return content;
}
