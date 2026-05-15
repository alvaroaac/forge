import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createIssuesCache } from '../../src/main/services/issues-cache';
import type { Issue } from '../../src/shared/types';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'forge-cache-'));
});

const sample: Issue = {
  id: 'FUL-1',
  title: 't',
  description: '',
  status: 'todo',
  priority: 'high',
  labels: [],
  url: '',
  updatedAt: '',
  isBug: false,
  assigneeId: null,
};

describe('issues-cache', () => {
  it('read empty array when missing', async () => {
    const c = createIssuesCache(join(dir, 'issues.json'));
    expect(await c.read()).toEqual([]);
  });

  it('round-trips writes', async () => {
    const c = createIssuesCache(join(dir, 'issues.json'));
    await c.write([sample]);
    expect(await c.read()).toEqual([sample]);
  });
});
