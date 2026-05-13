import type { IpcMain } from 'electron';
import { IpcChannel } from '../../shared/ipc-channels';
import type { IssuesCache } from '../services/issues-cache';
import type { Issue } from '../../shared/types';

export interface LinearDeps {
  cache: IssuesCache;
  fetchIssues: (client: unknown) => Promise<Issue[]>;
  client: unknown;
}

export function registerLinearHandlers(ipc: IpcMain, deps: LinearDeps): void {
  ipc.handle(IpcChannel.LinearFetchIssues, async () => deps.cache.read());
  ipc.handle(IpcChannel.LinearRefresh, async () => {
    const issues = await deps.fetchIssues(deps.client);
    await deps.cache.write(issues);
    return issues;
  });
}
