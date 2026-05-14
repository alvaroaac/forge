import type { IpcMain } from 'electron';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createConfigStore } from '../services/config-store';
import { createIssuesCache } from '../services/issues-cache';
import { checkAll } from '../services/auth-checker';
import type { RawLinearIssue } from '../services/linear-service';
import { fetchIssueDetail, fetchIssues } from '../services/linear-service';
import { readRepoContext } from '../services/repo-reader';
import { streamSpec } from '../services/spec-generator';
import { writeSpec } from '../services/spec-writer';
import { configPath, issuesCachePath } from '../lib/paths';
import { registerAuthHandlers } from './auth';
import { registerConfigHandlers } from './config';
import { registerLinearHandlers } from './linear';
import {
  registerSpecGenerateHandler,
  registerSpecGetHandler,
  registerSpecWriteHandler,
} from './spec';

interface LinearClient {
  getCurrentUser(): Promise<{ id: string; name: string; email: string }>;
  checkAuth(tokenPath?: string): Promise<boolean>;
  fetchAssignedIssues(assigneeId: string): Promise<RawLinearIssue[]>;
  fetchIssueDetail(identifier: string): Promise<RawLinearIssue | null>;
}

type LinearClientOptions = {
  teamKey: string;
  titlePrefix: string;
};

interface LinearSkillModule {
  createLinearClient(opts: LinearClientOptions): LinearClient;
}

async function loadLinearClient(
  appRoot: string,
): Promise<(opts: LinearClientOptions) => LinearClient> {
  const moduleUrl = pathToFileURL(
    join(appRoot, '.agents', 'skills', 'linear', 'reference', 'linear.mjs'),
  ).href;
  const mod = (await import(moduleUrl)) as unknown as LinearSkillModule;
  return mod.createLinearClient;
}

async function loadTemplate(appRoot: string): Promise<string> {
  const p = join(appRoot, 'docs', 'templates', 'spec-template.md');
  if (!existsSync(p)) {
    return '';
  }
  return readFile(p, 'utf-8');
}

export async function registerAll(ipc: IpcMain, appRoot: string): Promise<void> {
  const store = createConfigStore(configPath());
  const cache = createIssuesCache(issuesCachePath());
  const cfg = await store.get();
  const createLinearClient = await loadLinearClient(appRoot);
  const client = createLinearClient({ teamKey: cfg.linearTeamKey, titlePrefix: '' });
  const templateMd = await loadTemplate(appRoot);

  registerConfigHandlers(ipc, store);
  registerAuthHandlers(ipc, store, checkAll, client);
  registerLinearHandlers(ipc, {
    cache,
    fetchIssues: (linearClient) => fetchIssues(linearClient as LinearClient),
    fetchIssueDetail: (linearClient, issueId) =>
      fetchIssueDetail(linearClient as LinearClient, issueId),
    client,
  });
  registerSpecGetHandler(ipc, store);
  registerSpecGenerateHandler(ipc, {
    store,
    cache,
    readRepoContext,
    streamSpec,
    templateMd,
  });
  registerSpecWriteHandler(ipc, { store, writeSpec });
}
