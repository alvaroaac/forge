import type { IpcMain } from 'electron';
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { IpcChannel } from '../../shared/ipc-channels';
import type { ConfigStore } from '../services/config-store';
import type { Spec } from '../../shared/types';

const SAFE_ISSUE_ID = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

function isSafeIssueId(issueId: string): boolean {
  return SAFE_ISSUE_ID.test(issueId);
}

function specPath(repoPath: string, issueId: string): string | null {
  if (!isSafeIssueId(issueId)) {
    return null;
  }
  return join(repoPath, 'thoughts', 'tasks', issueId, 'initial-spec.md');
}

export function registerSpecGetHandler(ipc: IpcMain, store: ConfigStore): void {
  ipc.handle(IpcChannel.SpecGet, async (_e, payload: { issueId: string }): Promise<Spec | null> => {
    const cfg = await store.get();
    const target = specPath(cfg.repoPath, payload.issueId);
    if (!target) return null;

    try {
      const s = await stat(target);
      const content = await readFile(target, 'utf-8');
      return {
        issueId: payload.issueId,
        content,
        generatedAt: s.mtime.toISOString(),
        approved: false,
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  });
}
