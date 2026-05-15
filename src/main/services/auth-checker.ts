import { tryExecFile } from '../lib/exec';
import type { AuthStatus } from '../../shared/types';
import { checkComputron } from './computron-checker';

export interface LinearAuthClient {
  checkAuth: (tokenPath?: string) => Promise<boolean>;
}

export async function checkCli(command: string, args: readonly string[] = []): Promise<boolean> {
  try {
    const r = await tryExecFile(command, args);
    return r.ok;
  } catch {
    return false;
  }
}

export async function checkLinearApi(client: LinearAuthClient, tokenPath: string): Promise<boolean> {
  try {
    return await client.checkAuth(tokenPath);
  } catch {
    return false;
  }
}

export async function checkAll(opts: {
  linearTokenPath: string;
  linearClient: LinearAuthClient;
  computronRepoPath: string;
}): Promise<AuthStatus> {
  const [linear, claudeCode, codex, computron] = await Promise.all([
    checkLinearApi(opts.linearClient, opts.linearTokenPath),
    checkCli('claude', ['auth', 'status']),
    checkCli('codex', ['login', 'status']),
    checkComputron(opts.computronRepoPath),
  ]);
  return { linear, claudeCode, codex, computron };
}
