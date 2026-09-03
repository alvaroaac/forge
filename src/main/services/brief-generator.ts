import type { Issue } from '../../shared/types';
import { buildBriefPrompt } from './brief-prompt';

export interface StreamBriefInput {
  issue: Issue;
  computronRepoPath: string;
  model: string;
  curatedComments?: string;
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
    curatedComments?: string;
  }) => Promise<string>;
}

export async function streamBrief(input: StreamBriefInput): Promise<string> {
  const { system, user } = buildBriefPrompt({ issue: input.issue });
  return input.streamClaude({
    model: input.model,
    system,
    user,
    cwd: input.computronRepoPath,
    extraArgs: ['--add-dir', input.computronRepoPath, '--allowedTools', 'Read,Glob,Grep'],
    onChunk: input.onChunk,
    onStatus: input.onStatus,
    curatedComments: input.curatedComments,
  });
}
