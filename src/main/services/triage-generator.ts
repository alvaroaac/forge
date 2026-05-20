import type { Issue } from '../../shared/types';
import { buildTriagePrompt } from './triage-prompt';

export interface StreamTriageBriefInput {
  issue: Issue;
  computronRepoPath: string;
  model: string;
  onChunk: (delta: string) => void;
  onStatus?: (status: string) => void;
  streamClaude: (input: {
    model: string;
    system: string;
    user: string;
    cwd?: string;
    extraArgs: readonly string[];
    onChunk: (delta: string) => void;
    onStatus?: (status: string) => void;
  }) => Promise<string>;
}

export async function streamTriageBrief(input: StreamTriageBriefInput): Promise<string> {
  const { system, user } = buildTriagePrompt({ issue: input.issue });
  return input.streamClaude({
    model: input.model,
    system,
    user,
    cwd: input.computronRepoPath,
    extraArgs: ['--add-dir', input.computronRepoPath, '--allowedTools', 'Read,Glob,Grep'],
    onChunk: input.onChunk,
    onStatus: input.onStatus,
  });
}
