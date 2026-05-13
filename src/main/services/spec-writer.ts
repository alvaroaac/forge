import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

export async function writeSpec(opts: {
  repoPath: string;
  issueId: string;
  content: string;
}): Promise<string> {
  const dir = join(opts.repoPath, 'thoughts', 'tasks', opts.issueId);
  await mkdir(dir, { recursive: true });
  const target = join(dir, 'initial-spec.md');
  await writeFile(target, opts.content, 'utf-8');
  return target;
}
