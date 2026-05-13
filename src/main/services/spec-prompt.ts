import type { Issue } from '../../shared/types';
import type { RepoContext } from './repo-reader';

const SYSTEM = `You are a senior engineer writing a structured implementation spec.
Use the provided codebase context and issue details to produce a spec
following the template format exactly.`;

function renderThoughts(thoughts: RepoContext['thoughts']): string {
  return thoughts.map((t) => `--- ${t.name} ---\n${t.content}`).join('\n\n');
}

export function buildSpecPrompt(input: {
  issue: Issue;
  context: RepoContext;
  templateMd: string;
}): { system: string; user: string } {
  const { issue, context, templateMd } = input;

  const user = [
    '## Codebase context',
    '### AGENTS.md',
    context.agentsMd,
    '### thoughts/',
    renderThoughts(context.thoughts),
    '',
    `## Issue: ${issue.id} — ${issue.title}`,
    `Priority: ${issue.priority}  Labels: ${issue.labels.join(', ')}`,
    '',
    issue.description,
    '',
    '## Template — output must conform exactly',
    templateMd,
  ].join('\n');

  return { system: SYSTEM, user };
}
