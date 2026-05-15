import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

export async function checkRepoAccess(repoPath: string): Promise<void> {
  try {
    const repoStat = await stat(repoPath);
    if (!repoStat.isDirectory()) {
      throw new Error('path is not a directory');
    }

    const gitStat = await stat(join(repoPath, '.git'));
    if (!gitStat.isDirectory() && !gitStat.isFile()) {
      throw new Error('.git is not a directory or file');
    }

    await readdir(repoPath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Target repo is not readable: ${repoPath}. If macOS is asking for file permissions, approve the prompt and retry. Details: ${message}`,
    );
  }
}
