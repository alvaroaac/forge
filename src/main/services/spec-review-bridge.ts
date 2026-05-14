import { spawn, type ChildProcess, type SpawnOptions } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cleanSpecMarkdown } from '../../shared/spec-markdown';
import type { SpecReviewResult } from '../../shared/types';
import { assertSafeIssueId } from '../lib/issue-id';

const PLAN_REVIEW_INPUT_FILENAME = 'review-input.md';
const PLAN_REVIEW_OUTPUT_FILENAME = 'plan-review-output.md';

interface RunPlanReviewInput {
  inputPath: string;
  outputPath: string;
  spawnProcess: SpawnProcess;
}

export interface LaunchSpecReviewInput {
  issueId: string;
  content: string;
  model: string;
}

export interface LaunchSpecReviewDeps {
  createTempDir?: () => Promise<string>;
  writeFileUtf8?: (path: string, content: string) => Promise<void>;
  readFileUtf8?: (path: string) => Promise<string>;
  removeDir?: (path: string) => Promise<void>;
  spawnProcess?: SpawnProcess;
  reviseWithReview: (input: {
    model: string;
    originalSpecMarkdown: string;
    reviewFeedback: string;
  }) => Promise<SpecReviewResult>;
}

type SpawnProcess = (
  command: string,
  args: readonly string[],
  options: SpawnOptions,
) => ChildProcess;

function createTempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'forge-plan-review-'));
}

async function writeFileUtf8(path: string, content: string): Promise<void> {
  await writeFile(path, content, 'utf-8');
}

function readFileUtf8(path: string): Promise<string> {
  return readFile(path, 'utf-8');
}

async function removeDir(path: string): Promise<void> {
  await rm(path, { recursive: true, force: true });
}

function planReviewArgs(inputPath: string, outputPath: string): string[] {
  return [
    inputPath,
    '--fresh',
    '--split-by',
    'heading',
    '-o',
    'file',
    '--output-file',
    outputPath,
  ];
}

function toPlanReviewExitError(code: number | null, stderr: string): Error {
  const exitCode = code === null ? 'unknown' : String(code);
  const trimmed = stderr.trim();
  if (!trimmed) {
    return new Error(`plan-review exited with code ${exitCode}`);
  }
  return new Error(`plan-review exited with code ${exitCode}: ${trimmed}`);
}

function runPlanReview(input: RunPlanReviewInput): Promise<void> {
  const child = input.spawnProcess('plan-review', planReviewArgs(input.inputPath, input.outputPath), {
    shell: false,
    stdio: ['ignore', 'ignore', 'pipe'],
  });

  return new Promise<void>((resolve, reject) => {
    let stderr = '';
    let settled = false;

    const finish = (done: () => void): void => {
      if (settled) {
        return;
      }
      settled = true;
      done();
    };

    child.stderr?.on('data', (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      finish(() => reject(error));
    });

    child.on('close', (code) => {
      if (code === 0) {
        finish(() => resolve());
        return;
      }
      finish(() => reject(toPlanReviewExitError(code, stderr)));
    });
  });
}

async function readReviewOutput(path: string, readText: (path: string) => Promise<string>): Promise<string> {
  try {
    return await readText(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error('missing review output');
    }
    throw error;
  }
}

function toReviewLaunchError(error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error);
  return new Error(`Review launch failed: ${message}`);
}

async function cleanupTempDir(
  path: string | null,
  remove: (path: string) => Promise<void>,
): Promise<void> {
  if (!path) {
    return;
  }

  try {
    await remove(path);
  } catch {
    // Best effort cleanup for disposable temp files.
  }
}

export async function launchSpecReview(
  input: LaunchSpecReviewInput,
  deps: LaunchSpecReviewDeps,
): Promise<SpecReviewResult> {
  assertSafeIssueId(input.issueId);

  const cleanedContent = cleanSpecMarkdown(input.content);
  const createTempDirFn = deps.createTempDir ?? createTempDir;
  const writeText = deps.writeFileUtf8 ?? writeFileUtf8;
  const readText = deps.readFileUtf8 ?? readFileUtf8;
  const remove = deps.removeDir ?? removeDir;
  const spawnProcess = deps.spawnProcess ?? spawn;
  let reviewTempDir: string | null = null;

  try {
    reviewTempDir = await createTempDirFn();
    const inputPath = join(reviewTempDir, PLAN_REVIEW_INPUT_FILENAME);
    const outputPath = join(reviewTempDir, PLAN_REVIEW_OUTPUT_FILENAME);

    await writeText(inputPath, cleanedContent);
    await runPlanReview({ inputPath, outputPath, spawnProcess });

    const reviewFeedback = await readReviewOutput(outputPath, readText);
    return await deps.reviseWithReview({
      model: input.model,
      originalSpecMarkdown: cleanedContent,
      reviewFeedback,
    });
  } catch (error) {
    throw toReviewLaunchError(error);
  } finally {
    await cleanupTempDir(reviewTempDir, remove);
  }
}
