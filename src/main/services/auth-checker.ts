import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tryExec } from '../lib/exec';

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
