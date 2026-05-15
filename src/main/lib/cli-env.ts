import { delimiter } from 'node:path';
import { homedir } from 'node:os';

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
  return uniquePathEntries([...CLI_PATH_ENTRIES, ...basePath.split(delimiter)]).join(delimiter);
}

export function buildCliEnv(
  baseEnv: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  return {
    ...baseEnv,
    PATH: buildCliPath(baseEnv.PATH),
  };
}
