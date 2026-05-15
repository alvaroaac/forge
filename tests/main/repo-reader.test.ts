import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readRepoContext } from '../../src/main/services/repo-reader';

function makeRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), 'forge-repo-'));
  mkdirSync(join(dir, 'thoughts'));
  writeFileSync(join(dir, 'thoughts', 'conventions.md'), 'conv', 'utf-8');
  writeFileSync(join(dir, 'thoughts', 'initial-thoughts.md'), 'initial', 'utf-8');
  writeFileSync(join(dir, 'thoughts', 'orchestrators.md'), 'orch', 'utf-8');
  writeFileSync(join(dir, 'thoughts', 'tech-debt.md'), 'debt', 'utf-8');
  mkdirSync(join(dir, 'thoughts', 'tasks'));
  writeFileSync(join(dir, 'thoughts', 'tasks', 'ignored.md'), 'NO', 'utf-8');
  return dir;
}

describe('readRepoContext', () => {
  beforeEach(() => {
    // Reserved for per-test setup in this suite.
  });

  it('prefers AGENTS.md when present', async () => {
    const dir = makeRepo();
    writeFileSync(join(dir, 'AGENTS.md'), 'agents-content', 'utf-8');
    writeFileSync(join(dir, 'CLAUDE.md'), 'claude-content', 'utf-8');
    const ctx = await readRepoContext(dir);
    expect(ctx.agentsMd).toBe('agents-content');
  });
  it('falls back to CLAUDE.md when AGENTS.md is missing', async () => {
    const dir = makeRepo();
    writeFileSync(join(dir, 'CLAUDE.md'), 'claude-content', 'utf-8');
    const ctx = await readRepoContext(dir);
    expect(ctx.agentsMd).toBe('claude-content');
  });
  it('returns only high-signal top-level thought files for spec context', async () => {
    const dir = makeRepo();
    writeFileSync(join(dir, 'AGENTS.md'), 'a', 'utf-8');
    const ctx = await readRepoContext(dir);
    expect(ctx.thoughts.find((t) => t.name === 'conventions.md')?.content).toBe('conv');
    expect(ctx.thoughts.find((t) => t.name === 'initial-thoughts.md')?.content).toBe('initial');
    expect(ctx.thoughts.some((t) => t.name === 'tech-debt.md')).toBe(false);
    expect(ctx.thoughts.some((t) => t.name === 'orchestrators.md')).toBe(false);
    expect(ctx.thoughts.some((t) => t.name === 'ignored.md')).toBe(false);
  });
  it('returns empty string if neither AGENTS.md nor CLAUDE.md present', async () => {
    const empty = mkdtempSync(join(tmpdir(), 'empty-'));
    const ctx = await readRepoContext(empty);
    expect(ctx.agentsMd).toBe('');
    expect(ctx.thoughts).toEqual([]);
  });
});
