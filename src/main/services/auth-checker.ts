import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tryExec } from '../lib/exec';
import type { AuthStatus } from '../../shared/types';

export async function checkCli(command: string): Promise<boolean> {
  const r = await tryExec(command);
  return r.ok;
}

export async function checkLinearToken(path: string): Promise<boolean> {
  if (!existsSync(path)) return false;
  try {
    const raw = await readFile(path, 'utf-8');
    const parsed = JSON.parse(raw) as { access_token?: string };
    return typeof parsed.access_token === 'string' && parsed.access_token.length > 0;
  } catch {
    return false;
  }
}

export async function checkAll(opts: { linearTokenPath: string }): Promise<AuthStatus> {
  const [linear, claudeCode, codex] = await Promise.all([
    checkLinearToken(opts.linearTokenPath),
    checkCli('claude --version'),
    checkCli('codex --version'),
  ]);
  return { linear, claudeCode, codex };
}
