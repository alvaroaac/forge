import { EventEmitter } from 'node:events';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SpecReviewResult } from '../../src/shared/types';
import { launchSpecReview } from '../../src/main/services/spec-review-bridge';

type SpawnCall = {
  command: string;
  args: readonly string[];
  options: {
    shell: boolean;
    stdio: ['ignore', 'ignore', 'pipe'];
  };
};

type FakeChild = EventEmitter & {
  stderr: PassThrough;
};

type SpawnProcess = NonNullable<Parameters<typeof launchSpecReview>[1]['spawnProcess']>;

function createFakeChild(): FakeChild {
  const child = new EventEmitter() as FakeChild;
  child.stderr = new PassThrough();
  return child;
}

function createFakeSpawn(script: (ctx: { child: FakeChild; call: SpawnCall }) => void): {
  calls: SpawnCall[];
  spawnProcess: SpawnProcess;
} {
  const calls: SpawnCall[] = [];

  const spawnProcess: SpawnProcess = (command, args, options) => {
    const child = createFakeChild();
    const call = {
      command,
      args,
      options: options as SpawnCall['options'],
    };

    calls.push(call);
    queueMicrotask(() => script({ child, call }));

    return child as unknown as ReturnType<SpawnProcess>;
  };

  return { calls, spawnProcess };
}

describe('launchSpecReview', () => {
  let tempRoot: string;

  beforeEach(() => {
    tempRoot = mkdtempSync(join(tmpdir(), 'spec-review-bridge-test-'));
  });

  it('writes cleaned temp input, runs plan-review command, applies revision, and cleans up', async () => {
    let createdReviewDir = '';
    let writtenInputPath = '';
    let writtenInputContent = '';
    const createTempDir = vi.fn(async (): Promise<string> => {
      createdReviewDir = await mkdtemp(join(tempRoot, 'plan-review-'));
      return createdReviewDir;
    });
    const writeFileUtf8 = vi.fn(async (path: string, content: string): Promise<void> => {
      writtenInputPath = path;
      writtenInputContent = content;
      await writeFile(path, content, 'utf-8');
    });
    const removeDir = vi.fn(async (path: string): Promise<void> => {
      await rm(path, { recursive: true, force: true });
    });
    const reviseWithReview = vi.fn(
      async (): Promise<SpecReviewResult> => ({
        content: '# Revised spec',
        summary: {
          verdict: 'changes_requested',
          reviewerSummary: 'Tightened scope.',
          commentCount: 1,
          appliedChanges: ['Clarified acceptance criteria'],
          unresolvedComments: [],
        },
      }),
    );
    const { calls, spawnProcess } = createFakeSpawn(({ child, call }) => {
      const outputPath = call.args[7];
      void writeFile(outputPath!, '- [ ] Clarify scope in Task Summary', 'utf-8').then(() =>
        child.emit('close', 0),
      );
    });

    const result = await launchSpecReview(
      {
        issueId: 'FUL-42',
        content: 'Permission needed\n\n```markdown\n# Spec: FUL-42\n\n## Task Summary\nBody\n```',
        model: 'claude-sonnet-4-6',
      },
      {
        createTempDir,
        writeFileUtf8,
        removeDir,
        spawnProcess,
        reviseWithReview,
      },
    );

    expect(result).toEqual({
      content: '# Revised spec',
      summary: {
        verdict: 'changes_requested',
        reviewerSummary: 'Tightened scope.',
        commentCount: 1,
        appliedChanges: ['Clarified acceptance criteria'],
        unresolvedComments: [],
      },
    });
    expect(calls).toHaveLength(1);
    const [spawnCall] = calls;
    expect(spawnCall).toEqual({
      command: 'plan-review',
      args: [
        join(createdReviewDir, 'review-input.md'),
        '--fresh',
        '--split-by',
        'heading',
        '-o',
        'file',
        '--output-file',
        join(createdReviewDir, 'plan-review-output.md'),
      ],
      options: expect.objectContaining({
        shell: false,
        stdio: ['ignore', 'ignore', 'pipe'],
        env: expect.objectContaining({
          PATH: expect.stringContaining('/Applications/Codex.app/Contents/Resources'),
        }),
      }),
    });
    expect(writtenInputPath).toBe(join(createdReviewDir, 'review-input.md'));
    expect(writtenInputContent).toBe('# Spec: FUL-42\n\n## Task Summary\nBody');
    expect(reviseWithReview).toHaveBeenCalledWith({
      model: 'claude-sonnet-4-6',
      originalSpecMarkdown: '# Spec: FUL-42\n\n## Task Summary\nBody',
      reviewFeedback: '- [ ] Clarify scope in Task Summary',
    });
    expect(removeDir).toHaveBeenCalledWith(createdReviewDir);
  });

  it('rejects unsafe issue id before temp write or spawn', async () => {
    const createTempDir = vi.fn(async (): Promise<string> => mkdtemp(join(tempRoot, 'review-')));
    const reviseWithReview = vi.fn();
    const { calls, spawnProcess } = createFakeSpawn(({ child }) => {
      child.emit('close', 0);
    });

    await expect(
      launchSpecReview(
        {
          issueId: '../outside',
          content: '# Spec',
          model: 'claude-sonnet-4-6',
        },
        {
          createTempDir,
          spawnProcess,
          reviseWithReview,
        },
      ),
    ).rejects.toThrow('Unsafe issue id: ../outside');

    expect(createTempDir).not.toHaveBeenCalled();
    expect(calls).toHaveLength(0);
    expect(reviseWithReview).not.toHaveBeenCalled();
  });

  it('rejects on nonzero plan-review exit and attempts cleanup', async () => {
    let createdReviewDir = '';
    const createTempDir = vi.fn(async (): Promise<string> => {
      createdReviewDir = await mkdtemp(join(tempRoot, 'plan-review-'));
      return createdReviewDir;
    });
    const removeDir = vi.fn(async (path: string): Promise<void> => {
      await rm(path, { recursive: true, force: true });
    });
    const reviseWithReview = vi.fn();
    const { spawnProcess } = createFakeSpawn(({ child }) => {
      child.stderr.write('browser closed');
      child.emit('close', 2);
    });

    await expect(
      launchSpecReview(
        {
          issueId: 'FUL-42',
          content: '# Spec: FUL-42\n\n## Task Summary\nBody',
          model: 'claude-sonnet-4-6',
        },
        {
          createTempDir,
          removeDir,
          spawnProcess,
          reviseWithReview,
        },
      ),
    ).rejects.toThrow('Review launch failed: plan-review exited with code 2: browser closed');

    expect(reviseWithReview).not.toHaveBeenCalled();
    expect(removeDir).toHaveBeenCalledWith(createdReviewDir);
  });

  it('rejects when plan-review output is missing and attempts cleanup', async () => {
    let createdReviewDir = '';
    const createTempDir = vi.fn(async (): Promise<string> => {
      createdReviewDir = await mkdtemp(join(tempRoot, 'plan-review-'));
      return createdReviewDir;
    });
    const removeDir = vi.fn(async (path: string): Promise<void> => {
      await rm(path, { recursive: true, force: true });
    });
    const reviseWithReview = vi.fn();
    const { spawnProcess } = createFakeSpawn(({ child }) => {
      child.emit('close', 0);
    });

    await expect(
      launchSpecReview(
        {
          issueId: 'FUL-42',
          content: '# Spec: FUL-42\n\n## Task Summary\nBody',
          model: 'claude-sonnet-4-6',
        },
        {
          createTempDir,
          removeDir,
          spawnProcess,
          reviseWithReview,
        },
      ),
    ).rejects.toThrow('Review launch failed: missing review output');

    expect(reviseWithReview).not.toHaveBeenCalled();
    expect(removeDir).toHaveBeenCalledWith(createdReviewDir);
  });

  it('attempts cleanup even if cleanup fails', async () => {
    const reviewDir = join(tempRoot, 'plan-review');
    mkdirSync(reviewDir, { recursive: true });
    const createTempDir = vi.fn(async (): Promise<string> => reviewDir);
    const removeDir = vi.fn(async (): Promise<void> => {
      throw new Error('rm failed');
    });
    const reviseWithReview = vi.fn(
      async (): Promise<SpecReviewResult> => ({
        content: '# Revised',
        summary: {
          verdict: 'approved',
          reviewerSummary: 'ok',
          commentCount: 0,
          appliedChanges: [],
          unresolvedComments: [],
        },
      }),
    );
    const { spawnProcess } = createFakeSpawn(({ child, call }) => {
      void writeFile(call.args[7]!, 'Looks good', 'utf-8').then(() => child.emit('close', 0));
    });

    await expect(
      launchSpecReview(
        { issueId: 'FUL-42', content: '# Spec: FUL-42', model: 'claude-sonnet-4-6' },
        { createTempDir, removeDir, spawnProcess, reviseWithReview },
      ),
    ).resolves.toBeDefined();
    expect(removeDir).toHaveBeenCalledWith(reviewDir);
  });
});
