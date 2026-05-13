import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createConfigStore } from '../../src/main/services/config-store';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'forge-cfg-'));
});

describe('config-store', () => {
  it('returns defaults when file missing', async () => {
    const store = createConfigStore(join(dir, 'config.json'));
    const cfg = await store.get();
    expect(cfg.linearTeamKey).toBe('FUL');
    expect(cfg.claudeModel).toBe('claude-sonnet-4-6');
    expect(cfg.linearTokenPath).toMatch(/\.humanlayer\/riptide\/linear\.json$/);
  });

  it('persists patch and merges with defaults', async () => {
    const store = createConfigStore(join(dir, 'config.json'));
    await store.set({ repoPath: '/r' });
    const cfg = await store.get();
    expect(cfg.repoPath).toBe('/r');
    expect(cfg.linearTeamKey).toBe('FUL');
  });
});
