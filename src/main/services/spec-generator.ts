import { spawn, type ChildProcessWithoutNullStreams, type SpawnOptionsWithoutStdio } from 'node:child_process';
import { buildCliEnv } from '../lib/cli-env';

const CLAUDE_SPEC_TIMEOUT_MS = 120_000;

export interface StreamSpecInput {
  model: string;
  system: string;
  user: string;
  onChunk: (delta: string) => void;
  spawnProcess?: SpawnProcess;
}

export interface StreamClaudeInput extends StreamSpecInput {
  extraArgs?: readonly string[];
}

type SpawnProcess = (
  command: string,
  args: readonly string[],
  options: SpawnOptionsWithoutStdio,
) => ChildProcessWithoutNullStreams;

function buildClaudeArgs(input: StreamClaudeInput): string[] {
  return [
    '-p',
    '--model',
    input.model,
    '--append-system-prompt',
    input.system,
    ...(input.extraArgs ?? []),
    '--output-format',
    'text',
  ];
}

function toCliError(code: number | null, stderr: string): Error {
  const exitCode = code === null ? 'unknown' : String(code);
  const trimmedStderr = stderr.trim();
  if (!trimmedStderr) {
    return new Error(`Claude CLI exited with code ${exitCode}.`);
  }
  return new Error(`Claude CLI exited with code ${exitCode}: ${trimmedStderr}`);
}

export async function streamClaude(input: StreamClaudeInput): Promise<string> {
  const spawnProcess = input.spawnProcess ?? spawn;
  const claude = spawnProcess('claude', buildClaudeArgs(input), {
    shell: false,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: buildCliEnv(),
  });
  claude.stdin.end(input.user);

  return new Promise<string>((resolve, reject) => {
    let full = '';
    let stderr = '';
    let settled = false;

    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      claude.kill();
      reject(new Error(`Claude CLI timed out after ${CLAUDE_SPEC_TIMEOUT_MS / 1000}s.`));
    }, CLAUDE_SPEC_TIMEOUT_MS);

    const finish = (done: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      done();
    };

    claude.stdout.on('data', (chunk: Buffer | string) => {
      const delta = chunk.toString();
      if (!delta) return;
      full += delta;
      input.onChunk(delta);
    });

    claude.stderr.on('data', (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });

    claude.on('error', (error) => {
      finish(() => reject(error));
    });

    claude.on('close', (code) => {
      if (code === 0) {
        finish(() => resolve(full));
        return;
      }
      finish(() => reject(toCliError(code, stderr)));
    });
  });
}

export async function streamSpec(input: StreamSpecInput): Promise<string> {
  return streamClaude({ ...input, extraArgs: [] });
}
