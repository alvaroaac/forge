import { spawn, type ChildProcessWithoutNullStreams, type SpawnOptionsWithoutStdio } from 'node:child_process';
import { buildCliEnv } from '../lib/cli-env';

const CLAUDE_SPEC_TIMEOUT_MS = 180_000;

export interface StreamSpecInput {
  model: string;
  system: string;
  user: string;
  onChunk: (delta: string) => void;
  onStatus?: (status: string) => void;
  spawnProcess?: SpawnProcess;
  extraArgs?: readonly string[];
  timeoutMs?: number;
  cwd?: string;
}

export type StreamClaudeInput = StreamSpecInput;

type SpawnProcess = (
  command: string,
  args: readonly string[],
  options: SpawnOptionsWithoutStdio,
) => ChildProcessWithoutNullStreams;

function buildClaudeArgs(input: StreamClaudeInput): string[] {
  return [
    '-p',
    '--verbose',
    '--model',
    input.model,
    '--append-system-prompt',
    input.system,
    '--permission-mode',
    'dontAsk',
    ...(input.extraArgs ?? []),
    '--include-partial-messages',
    '--output-format',
    'stream-json',
  ];
}

function eventSummary(value: unknown): string {
  if (!value || typeof value !== 'object') {
    return String(value);
  }

  const event = value as Record<string, unknown>;
  const parts = [event.type, event.subtype, event.status, event.error]
    .filter((part): part is string => typeof part === 'string' && part.length > 0);
  return parts.join(':') || JSON.stringify(event).slice(0, 200);
}

function statusFromEvent(value: unknown): string | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const event = value as Record<string, unknown>;
  const type = typeof event.type === 'string' ? event.type : '';
  const subtype = typeof event.subtype === 'string' ? event.subtype : '';
  const status = typeof event.status === 'string' ? event.status : '';
  const error = typeof event.error === 'string' ? event.error : '';

  if (type === 'system' && subtype === 'init') {
    return 'Claude initialized the repo session';
  }
  if (type === 'system' && subtype === 'hook_started') {
    return 'Running Claude startup hooks';
  }
  if (type === 'system' && subtype === 'hook_response') {
    return 'Claude startup hook finished';
  }
  if (type === 'system' && status) {
    return `Claude status: ${status}`;
  }
  if (type === 'assistant' && error) {
    return `Claude reported: ${error}`;
  }
  if (type === 'assistant') {
    return 'Claude is drafting the spec';
  }
  if (type === 'result') {
    return 'Claude finished';
  }

  return null;
}

function textFromAssistantEvent(value: unknown): string {
  if (!value || typeof value !== 'object') {
    return '';
  }

  const event = value as {
    message?: {
      content?: Array<{ type?: string; text?: string }>;
    };
  };
  const content = event.message?.content;
  if (!Array.isArray(content)) {
    return '';
  }

  return content
    .filter((part) => part.type === 'text' && typeof part.text === 'string')
    .map((part) => part.text)
    .join('');
}

function resultText(value: unknown): string | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const event = value as { type?: unknown; result?: unknown };
  if (event.type !== 'result' || typeof event.result !== 'string') {
    return null;
  }

  return event.result;
}

function isErrorResult(value: unknown): boolean {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const event = value as { type?: unknown; is_error?: unknown };
  return event.type === 'result' && event.is_error === true;
}

function toCliError(code: number | null, stderr: string, debugTrail: readonly string[] = []): Error {
  const exitCode = code === null ? 'unknown' : String(code);
  const trimmedStderr = stderr.trim();
  const debug = debugTrail.length > 0 ? ` Last Claude events: ${debugTrail.join(' > ')}` : '';
  if (!trimmedStderr) {
    return new Error(`Claude CLI exited with code ${exitCode}.${debug}`);
  }
  return new Error(`Claude CLI exited with code ${exitCode}: ${trimmedStderr}${debug}`);
}

function toTimeoutError(
  stdout: string,
  stderr: string,
  timeoutMs: number,
  debugTrail: readonly string[],
): Error {
  const stdoutChars = stdout.length;
  const stderrTail = stderr.trim().slice(-500);
  const debug = debugTrail.length > 0 ? ` Last Claude events: ${debugTrail.join(' > ')}` : '';
  if (!stderrTail) {
    return new Error(
      `Claude CLI timed out after ${timeoutMs / 1000}s. Received ${stdoutChars} stdout chars and no stderr.${debug}`,
    );
  }

  return new Error(
    `Claude CLI timed out after ${timeoutMs / 1000}s. Received ${stdoutChars} stdout chars. Stderr tail: ${stderrTail}${debug}`,
  );
}

export async function streamClaude(input: StreamClaudeInput): Promise<string> {
  const spawnProcess = input.spawnProcess ?? spawn;
  const timeoutMs = input.timeoutMs ?? CLAUDE_SPEC_TIMEOUT_MS;
  const claude = spawnProcess('claude', buildClaudeArgs(input), {
    shell: false,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: buildCliEnv(),
    cwd: input.cwd,
  });
  claude.stdin.end(input.user);

  return new Promise<string>((resolve, reject) => {
    let full = '';
    let stderr = '';
    let stdoutRaw = '';
    let pendingLine = '';
    let lastAssistantText = '';
    let resultError: string | null = null;
    const debugTrail: string[] = [];
    let settled = false;

    const rememberEvent = (summary: string): void => {
      debugTrail.push(summary);
      if (debugTrail.length > 8) {
        debugTrail.shift();
      }
    };

    const emitText = (text: string): void => {
      if (!text) {
        return;
      }

      full += text;
      input.onChunk(text);
    };

    const applyAssistantText = (text: string): void => {
      if (!text || text === lastAssistantText) {
        return;
      }

      if (text.startsWith(lastAssistantText)) {
        emitText(text.slice(lastAssistantText.length));
      } else {
        emitText(text);
      }
      lastAssistantText = text;
    };

    const applyFinalResult = (text: string): void => {
      if (!text || text === full) {
        return;
      }

      if (text.startsWith(full)) {
        emitText(text.slice(full.length));
        return;
      }

      full = text;
      input.onChunk(text);
    };

    const handleEvent = (event: unknown): void => {
      rememberEvent(eventSummary(event));
      const status = statusFromEvent(event);
      if (status) {
        input.onStatus?.(status);
      }

      const assistantText = textFromAssistantEvent(event);
      if (assistantText && !isErrorResult(event)) {
        applyAssistantText(assistantText);
      }

      const finalText = resultText(event);
      if (finalText !== null) {
        if (isErrorResult(event)) {
          resultError = finalText;
          return;
        }
        applyFinalResult(finalText);
      }
    };

    const handleStdout = (text: string): void => {
      stdoutRaw += text;
      pendingLine += text;

      for (;;) {
        const newlineIndex = pendingLine.indexOf('\n');
        if (newlineIndex < 0) {
          return;
        }

        const line = pendingLine.slice(0, newlineIndex).trim();
        pendingLine = pendingLine.slice(newlineIndex + 1);
        if (!line) {
          continue;
        }

        try {
          handleEvent(JSON.parse(line));
        } catch {
          rememberEvent(`unparsed:${line.slice(0, 120)}`);
        }
      }
    };

    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      claude.kill();
      reject(toTimeoutError(stdoutRaw, stderr, timeoutMs, debugTrail));
    }, timeoutMs);

    const finish = (done: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      done();
    };

    claude.stdout.on('data', (chunk: Buffer | string) => {
      handleStdout(chunk.toString());
    });

    claude.stderr.on('data', (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });

    claude.on('error', (error) => {
      finish(() => reject(error));
    });

    claude.on('close', (code) => {
      const trailingLine = pendingLine.trim();
      if (trailingLine) {
        try {
          handleEvent(JSON.parse(trailingLine));
        } catch {
          rememberEvent(`unparsed:${trailingLine.slice(0, 120)}`);
        }
      }

      const claudeResultError = resultError;
      if (claudeResultError) {
        finish(() => reject(new Error(claudeResultError)));
        return;
      }

      if (code === 0) {
        finish(() => resolve(full));
        return;
      }
      finish(() => reject(toCliError(code, stderr, debugTrail)));
    });
  });
}

export async function streamSpec(input: StreamSpecInput): Promise<string> {
  return streamClaude({ ...input, extraArgs: input.extraArgs ?? [] });
}
