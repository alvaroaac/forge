import { readFile, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export interface RepoContext {
  agentsMd: string;
  thoughts: Array<{ name: string; content: string }>;
}

const SPEC_CONTEXT_THOUGHT_FILES = new Set(['conventions.md', 'initial-thoughts.md']);

async function readIfExists(path: string): Promise<string> {
  if (!existsSync(path)) return '';
  return readFile(path, 'utf-8');
}

async function readAgentsContext(repoPath: string): Promise<string> {
  const agents = await readIfExists(join(repoPath, 'AGENTS.md'));
  if (agents) return agents;
  return readIfExists(join(repoPath, 'CLAUDE.md'));
}

async function isMarkdownThoughtFile(thoughtsDir: string, name: string): Promise<boolean> {
  if (!name.endsWith('.md')) return false;
  if (!SPEC_CONTEXT_THOUGHT_FILES.has(name)) return false;
  const full = join(thoughtsDir, name);
  const stats = await stat(full);
  return stats.isFile();
}

async function listThoughtFiles(thoughtsDir: string): Promise<string[]> {
  if (!existsSync(thoughtsDir)) return [];
  const entries = await readdir(thoughtsDir);
  const checks = await Promise.all(
    entries.map(async (name) => ({
      name,
      include: await isMarkdownThoughtFile(thoughtsDir, name),
    })),
  );
  return checks.filter((entry) => entry.include).map((entry) => entry.name);
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
