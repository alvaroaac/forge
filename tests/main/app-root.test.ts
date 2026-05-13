import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveAppRoot } from '../../src/main/lib/app-root';

function makeRepoRoot(): string {
  const dir = mkdtempSync(join(tmpdir(), 'forge-app-root-'));
  mkdirSync(join(dir, '.agents', 'skills', 'linear', 'reference'), { recursive: true });
  writeFileSync(join(dir, '.agents', 'skills', 'linear', 'reference', 'linear.mjs'), '', 'utf-8');
  mkdirSync(join(dir, 'docs', 'templates'), { recursive: true });
  writeFileSync(join(dir, 'docs', 'templates', 'spec-template.md'), '# template', 'utf-8');
  return dir;
}

describe('resolveAppRoot', () => {
  it('walks up from built output to the repo root', () => {
    const repoRoot = makeRepoRoot();
    const builtMainDir = join(repoRoot, 'out', 'main');

    expect(resolveAppRoot(builtMainDir)).toBe(repoRoot);
  });

  it('falls back to cwd when the start path is outside the repo tree', () => {
    const repoRoot = makeRepoRoot();
    const outsideRoot = mkdtempSync(join(tmpdir(), 'forge-outside-'));
    const previousCwd = process.cwd();

    process.chdir(repoRoot);

    try {
      expect(resolveAppRoot(join(outsideRoot, 'app', 'main'))).toBe(realpathSync(repoRoot));
    } finally {
      process.chdir(previousCwd);
    }
  });
});
