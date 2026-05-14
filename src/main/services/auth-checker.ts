import { tryExec } from '../lib/exec';
import type { AuthStatus } from '../../shared/types';

export interface LinearAuthClient {
  checkAuth: (tokenPath?: string) => Promise<boolean>;
}

export async function checkCli(command: string): Promise<boolean> {
  try {
    const r = await tryExec(command);
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
}): Promise<AuthStatus> {
  const [linear, claudeCode, codex] = await Promise.all([
    checkLinearApi(opts.linearClient, opts.linearTokenPath),
    checkCli('claude auth status'),
    checkCli('codex login status'),
  ]);
  return { linear, claudeCode, codex };
}
