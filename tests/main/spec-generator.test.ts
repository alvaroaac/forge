import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { streamClaude, streamSpec } from '../../src/main/services/spec-generator';

type SpawnProcess = NonNullable<Parameters<typeof streamSpec>[0]['spawnProcess']>;

type SpawnCall = {
  command: string;
  args: readonly string[];
  options: Parameters<SpawnProcess>[2];
};

type FakeChild = EventEmitter & {
  stdin: PassThrough;
  stdout: PassThrough;
  stderr: PassThrough;
  kill: () => void;
};

function createFakeChild(): FakeChild {
  const child = new EventEmitter() as FakeChild;
  child.stdin = new PassThrough();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.kill = () => undefined;
  return child;
}

function createFakeSpawn(script: (child: FakeChild) => void): { calls: SpawnCall[]; spawnProcess: SpawnProcess } {
  const calls: SpawnCall[] = [];
  const spawnProcess: SpawnProcess = (command, args, options) => {
    const child = createFakeChild();
    calls.push({ command, args, options });
    queueMicrotask(() => script(child));
    return child as unknown as ReturnType<SpawnProcess>;
  };
  return { calls, spawnProcess };
}

function jsonLine(value: unknown): string {
  return `${JSON.stringify(value)}\n`;
}

describe('streamSpec', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('invokes claude with argument arrays, writes prompt to stdin, forwards stdout chunks, and returns full text', async () => {
    let stdinText = '';
    const { calls, spawnProcess } = createFakeSpawn((child) => {
      stdinText = child.stdin.read()?.toString() ?? '';
      child.stdout.write(jsonLine({
        type: 'assistant',
        message: { content: [{ type: 'text', text: '# Spec\n' }] },
      }));
      child.stdout.write(jsonLine({
        type: 'assistant',
        message: { content: [{ type: 'text', text: '# Spec\nBody' }] },
      }));
      child.stdout.write(jsonLine({
        type: 'result',
        is_error: false,
        result: '# Spec\nBody',
      }));
      child.emit('close', 0);
    });
    const chunks: string[] = [];
    const statuses: string[] = [];
    const full = await streamSpec({
      model: 'claude-sonnet-4-6',
      system: 'sys',
      user: 'user',
      onChunk: (c) => chunks.push(c),
      onStatus: (status) => statuses.push(status),
      spawnProcess,
    });

    expect(calls).toEqual([
      {
        command: 'claude',
        args: [
          '-p',
          '--verbose',
          '--model',
          'claude-sonnet-4-6',
          '--append-system-prompt',
          'sys',
          '--permission-mode',
          'dontAsk',
          '--include-partial-messages',
          '--output-format',
          'stream-json',
        ],
        options: expect.objectContaining({
          shell: false,
          stdio: ['pipe', 'pipe', 'pipe'],
          env: expect.objectContaining({
            PATH: expect.stringContaining('/Applications/Codex.app/Contents/Resources'),
          }),
        }),
      },
    ]);
    expect(stdinText).toBe('user');
    expect(chunks).toEqual(['# Spec\n', 'Body']);
    expect(statuses).toEqual([
      'Claude is drafting the spec',
      'Claude is drafting the spec',
      'Claude finished',
    ]);
    expect(full).toBe('# Spec\nBody');
  });

  it('rejects with a useful message when claude exits nonzero and includes stderr', async () => {
    const { spawnProcess } = createFakeSpawn((child) => {
      child.stderr.write('missing oauth session');
      child.emit('close', 2);
    });

    await expect(
      streamSpec({
        model: 'claude-sonnet-4-6',
        system: 'sys',
        user: 'user',
        onChunk: () => undefined,
        spawnProcess,
      }),
    ).rejects.toThrow('Claude CLI exited with code 2: missing oauth session');
  });

  it('includes received output counts and stderr tail when claude times out', async () => {
    vi.useFakeTimers();
    const { spawnProcess } = createFakeSpawn((child) => {
      child.stdout.write(jsonLine({ type: 'system', subtype: 'status', status: 'requesting' }));
      child.stderr.write('still thinking');
    });

    const result = streamSpec({
      model: 'claude-sonnet-4-6',
      system: 'sys',
      user: 'user',
      onChunk: () => undefined,
      spawnProcess,
    });

    const expectation = expect(result).rejects.toThrow(
      'Claude CLI timed out after 180s. Received 59 stdout chars. Stderr tail: still thinking Last Claude events: system:status:requesting',
    );
    await vi.advanceTimersByTimeAsync(180_000);
    await expectation;
  });

  it('passes through repo tool args when provided', async () => {
    const { calls, spawnProcess } = createFakeSpawn((child) => {
      child.emit('close', 0);
    });

    await streamSpec({
      model: 'claude-sonnet-4-6',
      system: 'sys',
      user: 'user',
      onChunk: () => undefined,
      spawnProcess,
      cwd: '/tmp/repo',
      extraArgs: ['--add-dir', '/tmp/repo', '--allowedTools', 'Read,Glob,Grep'],
    });

    expect(calls[0]?.args).toEqual([
      '-p',
      '--verbose',
      '--model',
      'claude-sonnet-4-6',
      '--append-system-prompt',
      'sys',
      '--permission-mode',
      'dontAsk',
      '--add-dir',
      '/tmp/repo',
      '--allowedTools',
      'Read,Glob,Grep',
      '--include-partial-messages',
      '--output-format',
      'stream-json',
    ]);
    expect(calls[0]?.options).toEqual(
      expect.objectContaining({
        cwd: '/tmp/repo',
      }),
    );
  });
});

describe('streamClaude', () => {
  it('inserts extra args after system prompt and before output format', async () => {
    const { calls, spawnProcess } = createFakeSpawn((child) => {
      child.emit('close', 0);
    });

    await streamClaude({
      model: 'claude-sonnet-4-6',
      system: 'sys',
      user: 'user',
      onChunk: () => undefined,
      spawnProcess,
      extraArgs: ['--add-dir', '/tmp/repo', '--allowedTools', 'Read,Glob,Grep'],
    });

    expect(calls[0]?.args).toEqual([
      '-p',
      '--verbose',
      '--model',
      'claude-sonnet-4-6',
      '--append-system-prompt',
      'sys',
      '--permission-mode',
      'dontAsk',
      '--add-dir',
      '/tmp/repo',
      '--allowedTools',
      'Read,Glob,Grep',
      '--include-partial-messages',
      '--output-format',
      'stream-json',
    ]);
  });

  it('rejects stream-json error results with the Claude result text', async () => {
    const { spawnProcess } = createFakeSpawn((child) => {
      child.stdout.write(jsonLine({
        type: 'assistant',
        error: 'authentication_failed',
        message: { content: [{ type: 'text', text: 'Not logged in · Please run /login' }] },
      }));
      child.stdout.write(jsonLine({
        type: 'result',
        is_error: true,
        result: 'Not logged in · Please run /login',
      }));
      child.emit('close', 1);
    });

    await expect(
      streamSpec({
        model: 'claude-sonnet-4-6',
        system: 'sys',
        user: 'user',
        onChunk: () => undefined,
        spawnProcess,
      }),
    ).rejects.toThrow('Not logged in · Please run /login');
  });
});
