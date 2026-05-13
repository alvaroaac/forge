import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Issue } from '../../shared/types';

export interface IssuesCache {
  read(): Promise<Issue[]>;
  write(issues: Issue[]): Promise<void>;
}

export function createIssuesCache(path: string): IssuesCache {
  return {
    async read() {
      if (!existsSync(path)) return [];
      const raw = await readFile(path, 'utf-8');
      return JSON.parse(raw) as Issue[];
    },
    async write(issues) {
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, JSON.stringify(issues, null, 2), 'utf-8');
    },
  };
}
