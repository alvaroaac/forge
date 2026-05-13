import { readFile, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export interface RepoContext {
  agentsMd: string;
  thoughts: Array<{ name: string; content: string }>;
}

async function readIfExists(path: string): Promise<string> {
  if (!existsSync(path)) return '';
  return readFile(path, 'utf-8');
}

async function readAgentsContext(repoPath: string): Promise<string> {
  const agents = await readIfExists(join(repoPath, 'AGENTS.md'));
  if (agents) return agents;
  return readIfExists(join(repoPath, 'CLAUDE.md'));
}

async function listThoughtFiles(thoughtsDir: string): Promise<string[]> {
  if (!existsSync(thoughtsDir)) return [];
  const entries = await readdir(thoughtsDir);
  const result: string[] = [];
  for (const name of entries) {
    if (!name.endsWith('.md')) continue;
    const full = join(thoughtsDir, name);
    const s = await stat(full);
    if (s.isFile()) result.push(name);
  }
  return result;
}

export async function readRepoContext(repoPath: string): Promise<RepoContext> {
  const agentsMd = await readAgentsContext(repoPath);
  const thoughtsDir = join(repoPath, 'thoughts');
  const names = await listThoughtFiles(thoughtsDir);
  const thoughts = await Promise.all(
    names.map(async (name) => ({
      name,
      content: await readFile(join(thoughtsDir, name), 'utf-8'),
    })),
  );
  return { agentsMd, thoughts };
}
