import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import type { AppConfig } from '../../shared/types';

const DEFAULTS: AppConfig = {
  linearTokenPath: join(homedir(), '.humanlayer', 'riptide', 'linear.json'),
  linearTeamKey: 'FUL',
  repoPath: '',
  claudeModel: 'claude-sonnet-4-6',
};

export interface ConfigStore {
  get(): Promise<AppConfig>;
  set(patch: Partial<AppConfig>): Promise<void>;
}

async function readMerged(path: string): Promise<AppConfig> {
  if (!existsSync(path)) return { ...DEFAULTS };
  const raw = await readFile(path, 'utf-8');
  const parsed = JSON.parse(raw) as Partial<AppConfig>;
  return { ...DEFAULTS, ...parsed };
}

export function createConfigStore(path: string): ConfigStore {
  return {
    async get() {
      return readMerged(path);
    },
    async set(patch) {
      const current = await readMerged(path);
      const merged = { ...current, ...patch };
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, JSON.stringify(merged, null, 2), 'utf-8');
    },
  };
}
