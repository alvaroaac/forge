import { delimiter } from 'node:path';
import { homedir } from 'node:os';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const CLI_PATH_ENTRIES = [
  `${homedir()}/.local/bin`,
  `${homedir()}/.npm-global/bin`,
  '/Applications/Codex.app/Contents/Resources',
  '/opt/homebrew/bin',
  '/opt/homebrew/sbin',
  '/usr/local/bin',
  '/usr/bin',
  '/bin',
  '/usr/sbin',
  '/sbin',
];

function compareNodeVersionDesc(left: string, right: string): number {
  return right.localeCompare(left, undefined, { numeric: true, sensitivity: 'base' });
}

export function discoverNvmBinPaths(home = homedir()): string[] {
  const nodeVersionsDir = join(home, '.nvm', 'versions', 'node');

  try {
    return readdirSync(nodeVersionsDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort(compareNodeVersionDesc)
      .map((version) => join(nodeVersionsDir, version, 'bin'));
  } catch {
    return [];
  }
}

function uniquePathEntries(entries: string[]): string[] {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    const trimmed = entry.trim();
    if (!trimmed || seen.has(trimmed)) {
      return false;
    }
    seen.add(trimmed);
    return true;
  });
}

export function buildCliPath(basePath = process.env.PATH ?? ''): string {
  return uniquePathEntries([
    ...CLI_PATH_ENTRIES,
    ...discoverNvmBinPaths(),
    ...basePath.split(delimiter),
  ]).join(delimiter);
}

export function buildCliEnv(baseEnv: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  return {
    ...baseEnv,
    PATH: buildCliPath(baseEnv.PATH),
  };
}
