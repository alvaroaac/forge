import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeSpec } from '../../src/main/services/spec-writer';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'forge-write-'));
});

describe('writeSpec', () => {
  it('writes to thoughts/tasks/[id]/initial-spec.md, creating dirs', async () => {
    await writeSpec({ repoPath: dir, issueId: 'FUL-7', content: '# Hi' });
    const target = join(dir, 'thoughts', 'tasks', 'FUL-7', 'initial-spec.md');
    expect(existsSync(target)).toBe(true);
    expect(readFileSync(target, 'utf-8')).toBe('# Hi');
  });
});
