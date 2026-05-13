import type { IpcMain } from 'electron';
import { readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { IpcChannel } from '../../shared/ipc-channels';
import type { ConfigStore } from '../services/config-store';
import type { Spec } from '../../shared/types';

function specPath(repoPath: string, issueId: string): string {
  return join(repoPath, 'thoughts', 'tasks', issueId, 'initial-spec.md');
}

export function registerSpecGetHandler(ipc: IpcMain, store: ConfigStore): void {
  ipc.handle(IpcChannel.SpecGet, async (_e, payload: { issueId: string }): Promise<Spec | null> => {
    const cfg = await store.get();
    const target = specPath(cfg.repoPath, payload.issueId);
    if (!existsSync(target)) return null;
    const content = await readFile(target, 'utf-8');
    const s = await stat(target);
    return {
      issueId: payload.issueId,
      content,
      generatedAt: s.mtime.toISOString(),
      approved: false,
    };
  });
}
