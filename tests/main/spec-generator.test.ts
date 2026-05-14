import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { streamSpec } from '../../src/main/services/spec-generator';

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

describe('streamSpec', () => {
  it('invokes claude with argument arrays, writes prompt to stdin, forwards stdout chunks, and returns full text', async () => {
    let stdinText = '';
    const { calls, spawnProcess } = createFakeSpawn((child) => {
      stdinText = child.stdin.read()?.toString() ?? '';
      child.stdout.write('# Spec\n');
      child.stdout.write('Body');
      child.emit('close', 0);
    });
    const chunks: string[] = [];
    const full = await streamSpec({
      model: 'claude-sonnet-4-6',
      system: 'sys',
      user: 'user',
      onChunk: (c) => chunks.push(c),
      spawnProcess,
    });

    expect(calls).toEqual([
      {
        command: 'claude',
        args: [
          '-p',
          '--model',
          'claude-sonnet-4-6',
          '--append-system-prompt',
          'sys',
          '--output-format',
          'text',
        ],
        options: { shell: false, stdio: ['pipe', 'pipe', 'pipe'] },
      },
    ]);
    expect(stdinText).toBe('user');
    expect(chunks).toEqual(['# Spec\n', 'Body']);
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
});
