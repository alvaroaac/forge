import { describe, it, expect, beforeEach } from 'vitest';
import { existsSync, mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeTriageBrief } from '../../src/main/services/triage-writer';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'forge-triage-write-'));
});

describe('writeTriageBrief', () => {
  it('creates parent dir and writes triage brief in create mode', async () => {
    const result = await writeTriageBrief({
      repoPath: dir,
      issueId: 'FUL-10',
      content: '# triage',
      mode: 'create',
    });

    const target = join(dir, 'thoughts', 'tasks', 'FUL-10', 'triage-brief.md');
    expect(result).toEqual({ path: target, written: true, exists: false });
    expect(existsSync(target)).toBe(true);
    expect(readFileSync(target, 'utf-8')).toBe('# triage');
  });

  it('does not overwrite existing triage brief in create mode', async () => {
    const targetDir = join(dir, 'thoughts', 'tasks', 'FUL-11');
    mkdirSync(targetDir, { recursive: true });
    const target = join(targetDir, 'triage-brief.md');
    writeFileSync(target, '# old', 'utf-8');

    const result = await writeTriageBrief({
      repoPath: dir,
      issueId: 'FUL-11',
      content: '# new',
      mode: 'create',
    });

    expect(result).toEqual({ path: target, written: false, exists: true });
    expect(readFileSync(target, 'utf-8')).toBe('# old');
  });

  it('overwrites existing triage brief in overwrite mode', async () => {
    const targetDir = join(dir, 'thoughts', 'tasks', 'FUL-12');
    mkdirSync(targetDir, { recursive: true });
    const target = join(targetDir, 'triage-brief.md');
    writeFileSync(target, '# old', 'utf-8');

    const result = await writeTriageBrief({
      repoPath: dir,
      issueId: 'FUL-12',
      content: '# new',
      mode: 'overwrite',
    });

    expect(result).toEqual({ path: target, written: true, exists: true });
    expect(readFileSync(target, 'utf-8')).toBe('# new');
  });
});
