import { homedir } from 'node:os';
import { join } from 'node:path';

export function expandHome(p: string): string {
  if (!p.startsWith('~')) return p;
  return join(homedir(), p.slice(1));
}

export function forgeDir(): string {
  return join(homedir(), '.forge');
}

export function configPath(): string {
  return join(forgeDir(), 'config.json');
}

export function issuesCachePath(): string {
  return join(forgeDir(), 'issues.json');
}
