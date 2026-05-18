import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkComputron } from '../../src/main/services/computron-checker';

let tempDir: string | null = null;

async function makeTempDir(): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), 'forge-computron-'));
  await mkdir(path, { recursive: true });
  return path;
}

describe('checkComputron', () => {
  beforeEach(async () => {
    tempDir = await makeTempDir();
  });

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
      tempDir = null;
    }
  });

  it('returns false for empty path', async () => {
    await expect(checkComputron('')).resolves.toBe(false);
  });

  it('returns false when path does not exist', async () => {
    const missingPath = join(tempDir as string, 'does-not-exist');
    await expect(checkComputron(missingPath)).resolves.toBe(false);
  });

  it('returns false when path exists but has no .git directory', async () => {
    await writeFile(join(tempDir as string, 'README.md'), 'test', 'utf-8');
    await expect(checkComputron(tempDir as string)).resolves.toBe(false);
  });

  it('returns true when path is a git repo', async () => {
    await mkdir(join(tempDir as string, '.git'), { recursive: true });
    await expect(checkComputron(tempDir as string)).resolves.toBe(true);
  });
});
