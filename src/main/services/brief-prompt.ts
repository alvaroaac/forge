import type { Issue } from '../../shared/types';

const SYSTEM = `You are reviewing an unrefined Linear triage issue. Your goal is to produce
a short engineering brief that helps a human reviewer decide what to do with this
ticket.

You have read-only access to the team's main codebase at the current working
directory (mounted via --add-dir). Use Glob and Grep to locate code likely
relevant to the issue. Use Read sparingly - only on files that look directly
related. As a recommendation, aim for roughly 6 tool calls; this is a soft hint,
not a hard limit.

Output sections, in this exact order:

1. **What the user likely wants** — 1-3 sentences, plain language.
2. **Likely affected components** — bullet list of file paths or modules in
   the computron repo, one-line reason each.
3. **Open questions for reporter** — bullet list of things ambiguous in the
   issue.
4. **Suggested next step** — one of: "Needs reproduction", "Needs spec",
   "Probable duplicate of <X>", "Ready for spec", or "Out of scope" — plus one
   sentence why.

Return only the markdown brief. No preamble, no postscript, no code fences
wrapping the whole output.`;

function formatLabels(labels: string[]): string {
  return labels.length > 0 ? labels.join(', ') : '(none)';
}

export function buildBriefPrompt(input: { issue: Issue }): { system: string; user: string } {
  const { issue } = input;

  const user = [
    `Issue: ${issue.id} ${issue.title}`,
    `Priority: ${issue.priority}`,
    `Labels: ${formatLabels(issue.labels)}`,
    '',
    issue.description,
    '',
    'cwd is the computron repo root.',
    '',
    'Suggested sections to answer:',
    '1. What the user likely wants',
    '2. Likely affected components',
    '3. Open questions for reporter',
    '4. Suggested next step',
  ].join('\n');

  return { system: SYSTEM, user };
}
