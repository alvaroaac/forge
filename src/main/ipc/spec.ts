import type { IpcMain } from 'electron';
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { IpcChannel } from '../../shared/ipc-channels';
import { cleanSpecMarkdown } from '../../shared/spec-markdown';
import { assertSafeIssueId, isSafeIssueId } from '../lib/issue-id';
import type { ConfigStore } from '../services/config-store';
import type { IssuesCache } from '../services/issues-cache';
import type { RepoContext } from '../services/repo-reader';
import { buildSpecPrompt } from '../services/spec-prompt';
import type { Issue, Spec, SpecReviewResult } from '../../shared/types';

type SpecGenerateEventSender = {
  send: (channel: string, payload: unknown) => void;
};

type SpecGenerateEvent = {
  sender: SpecGenerateEventSender;
};

type SpecGeneratePayload = {
  issueId: string;
  model?: string;
};

type SpecWritePayload = {
  issueId: string;
  content: string;
};

type SpecLaunchReviewPayload = {
  issueId: string;
  content: string;
  model: string;
};

type StreamSpecFn = (input: {
  model: string;
  system: string;
  user: string;
  onChunk: (delta: string) => void;
}) => Promise<string>;

export interface SpecGenerateDeps {
  store: ConfigStore;
  cache: IssuesCache;
  readRepoContext: (repoPath: string) => Promise<RepoContext>;
  streamSpec: StreamSpecFn;
  templateMd: string;
}

export interface SpecWriteDeps {
  store: ConfigStore;
  writeSpec: (opts: { repoPath: string; issueId: string; content: string }) => Promise<string>;
}

export interface SpecLaunchReviewDeps {
  launchReview: (input: SpecLaunchReviewPayload) => Promise<SpecReviewResult>;
}

function specPath(repoPath: string, issueId: string): string | null {
  if (!isSafeIssueId(issueId)) {
    return null;
  }
  return join(repoPath, 'thoughts', 'tasks', issueId, 'initial-spec.md');
}

function findIssue(issues: Issue[], issueId: string): Issue {
  if (!isSafeIssueId(issueId)) {
    throw new Error(`Issue not found in cache: ${issueId}`);
  }
  const found = issues.find((issue) => issue.id === issueId);
  if (!found) {
    throw new Error(`Issue not found in cache: ${issueId}`);
  }
  return found;
}

function pickSpecModel(payload: SpecGeneratePayload, fallbackModel: string): string {
  const requestedModel = payload.model?.trim();
  if (!requestedModel) {
    return fallbackModel;
  }
  return requestedModel;
}

function sendSpecChunk(
  sender: SpecGenerateEventSender,
  issueId: string,
  delta: string,
  done: boolean,
): void {
  sender.send(IpcChannel.SpecStreamChunk, { issueId, delta, done });
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
        content: cleanSpecMarkdown(content),
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

export function registerSpecGenerateHandler(ipc: IpcMain, deps: SpecGenerateDeps): void {
  ipc.handle(
    IpcChannel.SpecGenerate,
    async (event: SpecGenerateEvent, payload: SpecGeneratePayload) => {
      try {
        const cfg = await deps.store.get();
        const issues = await deps.cache.read();
        const issue = findIssue(issues, payload.issueId);
        const context = await deps.readRepoContext(cfg.repoPath);
        const prompt = buildSpecPrompt({ issue, context, templateMd: deps.templateMd });
        const content = cleanSpecMarkdown(
          await deps.streamSpec({
            model: pickSpecModel(payload, cfg.claudeModel),
            system: prompt.system,
            user: prompt.user,
            onChunk: (delta) => sendSpecChunk(event.sender, payload.issueId, delta, false),
          }),
        );
        sendSpecChunk(event.sender, payload.issueId, '', true);
        event.sender.send(IpcChannel.SpecGenerateDone, { issueId: payload.issueId });
        return { content, issueId: payload.issueId };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        event.sender.send(IpcChannel.SpecGenerateError, { issueId: payload.issueId, message });
        throw error;
      }
    },
  );
}

export function registerSpecWriteHandler(ipc: IpcMain, deps: SpecWriteDeps): void {
  ipc.handle(IpcChannel.SpecWrite, async (_event, payload: SpecWritePayload) => {
    assertSafeIssueId(payload.issueId);

    const cfg = await deps.store.get();
    const content = cleanSpecMarkdown(payload.content);
    await deps.writeSpec({ repoPath: cfg.repoPath, issueId: payload.issueId, content });

    return { issueId: payload.issueId, content };
  });
}

export function registerSpecLaunchReviewHandler(ipc: IpcMain, deps: SpecLaunchReviewDeps): void {
  ipc.handle(
    IpcChannel.SpecLaunchReview,
    async (_event, payload: SpecLaunchReviewPayload): Promise<SpecReviewResult> => {
      return deps.launchReview({
        issueId: payload.issueId,
        content: payload.content,
        model: payload.model,
      });
    },
  );
}
