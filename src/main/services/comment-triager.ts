import type { LinearComment } from './comment-fetcher';
import type { StreamClaudeInput } from './spec-generator';

export const COMMENT_TRIAGER_MODEL = 'claude-haiku-4-5-20251001';
export const COMMENT_TRIAGE_TIMEOUT_MS = 60_000;

export const COMMENT_TRIAGER_SYSTEM_PROMPT = `You are filtering and restructuring Linear ticket comments for an engineer
who is about to triage or spec the ticket. Your only job is to produce a
curated comment context block that surfaces what matters and shortens what
does not.

You receive: the issue title, issue description, and a list of comments
(each with author, timestamp, and markdown body). Bot/automation comments
have already been stripped before you see them.

Output exactly two sections, in this order, using this markdown format:

## Relevant Comments

### {Author} — {YYYY-MM-DD}
> {Optional one-line context annotation. Omit the blockquote line entirely
> if no annotation adds value.}
{Verbatim comment body, unchanged.}

---

(Repeat per relevant comment. Separate with a \`---\` line.)

## Skipped Comments
- {Author} ({reason}): {one-line summary of what was skipped}.

Rules:

1. A comment is RELEVANT if it adds technical detail, reproduction info,
   constraints, decisions, links to related work, or reporter clarifications
   that change how the engineer would approach the ticket.
2. A comment is SKIPPED if it is administrative chatter, "+1" reactions,
   scheduling, off-topic, or noise.
3. If a thread (multiple comments) concludes with an explicit "won't do this"
   / "rejected" / "we decided against this", skip the whole thread
   with one combined summary line in Skipped Comments.
4. If a comment contains a pasted Slack thread or similar long
   conversation (rule of thumb: 50+ messages or 2000+ words), do NOT paste
   it verbatim. Instead:
   - Summarize the on-topic portion.
   - Strip per-message timestamps.
   - Collapse consecutive messages from the same author into a single
     block under one author header.
   - Preserve substantive technical content verbatim within that block.
   The result replaces the verbatim body for that comment.
5. Use \`reason\` values from this set only: \`bot\` (shouldn't happen,
   pre-filtered), \`won't-do\`, \`noise\`, \`filler\`, \`off-topic\`.
6. If no comments are relevant, output \`## Relevant Comments\\n_(none)_\`
   followed by the Skipped Comments section.
7. Return only the two sections. No preamble, no postscript, no code
   fences wrapping the whole output.`;

export interface TriageCommentsInput {
  issueTitle: string;
  issueDescription: string;
  comments: LinearComment[];
  streamClaude: (input: StreamClaudeInput) => Promise<string>;
}

function renderUserPrompt(input: TriageCommentsInput): string {
  const header = `# Issue\n\n**Title:** ${input.issueTitle}\n\n**Description:**\n\n${input.issueDescription}\n\n# Comments\n`;
  const body = input.comments
    .map((c, idx) => `\n### ${idx + 1}. ${c.authorName} — ${c.createdAt}\n\n${c.body}\n`)
    .join('');
  return `${header}${body}`;
}

export async function triageComments(input: TriageCommentsInput): Promise<string> {
  if (input.comments.length === 0) {
    return '';
  }
  return input.streamClaude({
    model: COMMENT_TRIAGER_MODEL,
    system: COMMENT_TRIAGER_SYSTEM_PROMPT,
    user: renderUserPrompt(input),
    timeoutMs: COMMENT_TRIAGE_TIMEOUT_MS,
    onChunk: () => undefined,
  });
}
