import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkRepoAccess } from '../../src/main/services/repo-access-checker';

describe('checkRepoAccess', () => {
  it('resolves when repo root and .git directory are readable', async () => {
    const repo = await mkdtemp(join(tmpdir(), 'forge-repo-access-'));
    await mkdir(join(repo, '.git'));

    await expect(checkRepoAccess(repo)).resolves.toBeUndefined();
  });

  it('resolves when .git is a file for worktree-style repos', async () => {
    const repo = await mkdtemp(join(tmpdir(), 'forge-repo-access-'));
    await writeFile(join(repo, '.git'), 'gitdir: ../main/.git/worktrees/demo', 'utf-8');

    await expect(checkRepoAccess(repo)).resolves.toBeUndefined();
  });

  it('rejects with permission retry guidance when the repo is not readable', async () => {
    await expect(checkRepoAccess('/path/that/does/not/exist')).rejects.toThrow(
      /If macOS is asking for file permissions, approve the prompt and retry/,
    );
  });
});
