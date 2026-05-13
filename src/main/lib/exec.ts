import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import type { Result } from '../../shared/result';
import { ok, err } from '../../shared/result';

const pExec = promisify(exec);

export async function tryExec(cmd: string): Promise<Result<{ stdout: string; stderr: string }>> {
  try {
    const { stdout, stderr } = await pExec(cmd, { timeout: 5000 });
    return ok({ stdout, stderr });
  } catch (e) {
    return err(e instanceof Error ? e : new Error(String(e)));
  }
}
