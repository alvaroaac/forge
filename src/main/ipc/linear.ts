import type { IpcMain } from 'electron';
import { IpcChannel } from '../../shared/ipc-channels';
import type { IssuesCache } from '../services/issues-cache';
import type { Issue } from '../../shared/types';

export interface LinearDeps {
  cache: IssuesCache;
  fetchIssues: (client: unknown) => Promise<Issue[]>;
  fetchIssueDetail: (client: unknown, issueId: string) => Promise<Issue | null>;
  fetchTriage: (client: unknown) => Promise<Issue[]>;
  getViewerId: (client: unknown) => Promise<string>;
  client: unknown;
}

export function registerLinearHandlers(ipc: IpcMain, deps: LinearDeps): void {
  let cachedViewerId: string | null = null;

  ipc.handle(IpcChannel.LinearFetchIssues, async () => deps.cache.read());
  ipc.handle(IpcChannel.LinearFetchIssueDetail, async (_event, payload: { issueId: string }) =>
    deps.fetchIssueDetail(deps.client, payload.issueId),
  );
  ipc.handle(IpcChannel.LinearFetchTeamTriage, async () => deps.fetchTriage(deps.client));
  ipc.handle(IpcChannel.LinearGetViewerId, async () => {
    if (cachedViewerId === null) {
      cachedViewerId = await deps.getViewerId(deps.client);
    }
    return cachedViewerId;
  });
  ipc.handle(IpcChannel.LinearRefresh, async () => {
    const issues = await deps.fetchIssues(deps.client);
    await deps.cache.write(issues);
    return issues;
  });
}
