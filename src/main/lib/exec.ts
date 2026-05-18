import { exec, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { Result } from '../../shared/result';
import { ok, err } from '../../shared/result';
import { buildCliEnv } from './cli-env';

const pExec = promisify(exec);
const pExecFile = promisify(execFile);

export async function tryExec(cmd: string): Promise<Result<{ stdout: string; stderr: string }>> {
  try {
    const { stdout, stderr } = await pExec(cmd, { timeout: 5000, env: buildCliEnv() });
    return ok({ stdout, stderr });
  } catch (e) {
    return err(e instanceof Error ? e : new Error(String(e)));
  }
}

export async function tryExecFile(
  file: string,
  args: readonly string[] = [],
): Promise<Result<{ stdout: string; stderr: string }>> {
  try {
    const { stdout, stderr } = await pExecFile(file, [...args], {
      timeout: 5000,
      env: buildCliEnv(),
    });
    return ok({ stdout, stderr });
  } catch (e) {
    return err(e instanceof Error ? e : new Error(String(e)));
  }
}
