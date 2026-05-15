import { access, mkdir, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { join } from 'node:path';

type TriageWriteMode = 'create' | 'overwrite';

type WriteResult = {
  path: string;
  written: boolean;
  exists: boolean;
};

async function exists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function writeTriageBrief(opts: {
  repoPath: string;
  issueId: string;
  content: string;
  mode: TriageWriteMode;
}): Promise<WriteResult> {
  const dir = join(opts.repoPath, 'thoughts', 'tasks', opts.issueId);
  const target = join(dir, 'triage-brief.md');
  const preExists = await exists(target);

  if (opts.mode === 'create' && preExists) {
    return {
      path: target,
      written: false,
      exists: true,
    };
  }

  await mkdir(dir, { recursive: true });
  await writeFile(target, opts.content, 'utf-8');

  return {
    path: target,
    written: true,
    exists: preExists,
  };
}
