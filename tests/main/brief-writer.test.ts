import { describe, it, expect, beforeEach } from 'vitest';
import { existsSync, mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeBrief } from '../../src/main/services/brief-writer';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'forge-brief-write-'));
});

describe('writeBrief', () => {
  it('creates parent dir and writes a brief in create mode', async () => {
    const result = await writeBrief({
      repoPath: dir,
      issueId: 'FUL-10',
      content: '# brief',
      mode: 'create',
    });

    const target = join(dir, 'thoughts', 'tasks', 'FUL-10', 'brief.md');
    expect(result).toEqual({ path: target, written: true, exists: false });
    expect(existsSync(target)).toBe(true);
    expect(readFileSync(target, 'utf-8')).toBe('# brief');
  });

  it('does not overwrite an existing brief in create mode', async () => {
    const targetDir = join(dir, 'thoughts', 'tasks', 'FUL-11');
    mkdirSync(targetDir, { recursive: true });
    const target = join(targetDir, 'brief.md');
    writeFileSync(target, '# old', 'utf-8');

    const result = await writeBrief({
      repoPath: dir,
      issueId: 'FUL-11',
      content: '# new',
      mode: 'create',
    });

    expect(result).toEqual({ path: target, written: false, exists: true });
    expect(readFileSync(target, 'utf-8')).toBe('# old');
  });

  it('overwrites an existing brief in overwrite mode', async () => {
    const targetDir = join(dir, 'thoughts', 'tasks', 'FUL-12');
    mkdirSync(targetDir, { recursive: true });
    const target = join(targetDir, 'brief.md');
    writeFileSync(target, '# old', 'utf-8');

    const result = await writeBrief({
      repoPath: dir,
      issueId: 'FUL-12',
      content: '# new',
      mode: 'overwrite',
    });

    expect(result).toEqual({ path: target, written: true, exists: true });
    expect(readFileSync(target, 'utf-8')).toBe('# new');
  });
});
