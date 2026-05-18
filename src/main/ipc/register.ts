import type { IpcMain } from 'electron';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createConfigStore } from '../services/config-store';
import { createIssuesCache } from '../services/issues-cache';
import { checkAll } from '../services/auth-checker';
import type { RawLinearIssue } from '../services/linear-service';
import { fetchIssueDetail, fetchIssues, fetchTriage } from '../services/linear-service';
import { readRepoContext } from '../services/repo-reader';
import { streamClaude, streamSpec } from '../services/spec-generator';
import { launchSpecReview } from '../services/spec-review-bridge';
import { reviseSpecWithReview } from '../services/spec-review-revision';
import { streamTriageBrief } from '../services/triage-generator';
import { writeTriageBrief } from '../services/triage-writer';
import { writeSpec } from '../services/spec-writer';
import { checkRepoAccess } from '../services/repo-access-checker';
import { configPath, issuesCachePath } from '../lib/paths';
import { registerAuthHandlers } from './auth';
import { registerConfigHandlers } from './config';
import { registerLinearHandlers } from './linear';
import { registerTriageGenerateHandler, registerTriageWriteHandler } from './triage';
import {
  registerSpecGenerateHandler,
  registerSpecGetHandler,
  registerSpecLaunchReviewHandler,
  registerSpecWriteHandler,
} from './spec';

interface LinearClient {
  getCurrentUser(): Promise<{ id: string; name: string; email: string }>;
  checkAuth(tokenPath?: string): Promise<boolean>;
  fetchAssignedIssues(assigneeId: string): Promise<RawLinearIssue[]>;
  fetchIssueDetail(identifier: string): Promise<RawLinearIssue | null>;
  fetchTeamTriage(): Promise<RawLinearIssue[]>;
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
    fetchTriage: (linearClient) => fetchTriage(linearClient as LinearClient),
    getViewerId: (linearClient) =>
      (linearClient as LinearClient).getCurrentUser().then((me) => me.id),
    client,
  });
  registerSpecGetHandler(ipc, store);
  registerSpecGenerateHandler(ipc, {
    store,
    cache,
    readRepoContext,
    streamSpec,
    preflightClaudeRepoAccess: ({ repoPath }) => checkRepoAccess(repoPath),
    templateMd,
  });
  registerSpecWriteHandler(ipc, { store, writeSpec });
  registerSpecLaunchReviewHandler(ipc, {
    launchReview: ({ issueId, content, model }) =>
      launchSpecReview(
        { issueId, content, model },
        {
          reviseWithReview: ({ model: selectedModel, originalSpecMarkdown, reviewFeedback }) =>
            reviseSpecWithReview({
              model: selectedModel,
              originalSpecMarkdown,
              reviewFeedback,
              runModel: ({ model: runModel, system, user }) =>
                streamSpec({
                  model: runModel,
                  system,
                  user,
                  onChunk: () => undefined,
                }),
            }),
        },
      ),
  });
  registerTriageGenerateHandler(ipc, {
    store,
    fetchTriageList: () => fetchTriage(client as LinearClient),
    streamTriageBrief: ({ issue, computronRepoPath, model, onChunk }) =>
      streamTriageBrief({
        issue,
        computronRepoPath,
        model,
        onChunk,
        streamClaude,
      }),
  });
  registerTriageWriteHandler(ipc, { store, writeTriageBrief });
}
