import { stat } from 'node:fs/promises';
import { join } from 'node:path';

export async function checkComputron(computronRepoPath: string): Promise<boolean> {
  if (!computronRepoPath) return false;
  try {
    const repoStat = await stat(computronRepoPath);
    if (!repoStat.isDirectory()) return false;
    const gitStat = await stat(join(computronRepoPath, '.git'));
    return gitStat.isDirectory();
  } catch {
    return false;
  }
}
