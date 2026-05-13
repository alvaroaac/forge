import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

function hasRepoMarkers(dir: string): boolean {
  return (
    existsSync(join(dir, '.agents', 'skills', 'linear', 'reference', 'linear.mjs')) &&
    existsSync(join(dir, 'docs', 'templates', 'spec-template.md'))
  );
}

function walkUpForRepoRoot(startDir: string): string | null {
  let current = resolve(startDir);

  for (;;) {
    if (hasRepoMarkers(current)) {
      return current;
    }

    const parent = dirname(current);
    if (parent === current) {
      return null;
    }

    current = parent;
  }
}

export function resolveAppRoot(startDir: string): string {
  return walkUpForRepoRoot(startDir) ?? walkUpForRepoRoot(process.cwd()) ?? startDir;
}
