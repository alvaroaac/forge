import type { IpcMain } from 'electron';
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { IpcChannel } from '../../shared/ipc-channels';
import { cleanSpecMarkdown } from '../../shared/spec-markdown';
import { assertSafeIssueId, isSafeIssueId } from '../lib/issue-id';
import type { ConfigStore } from '../services/config-store';
import type { IssuesCache } from '../services/issues-cache';
import { notifyDone, notifyDoneBestEffort, type NotifyDoneFn } from '../services/notifications';
import type { RepoContext } from '../services/repo-reader';
import { buildSpecPrompt } from '../services/spec-prompt';
import type { Issue, Spec, SpecReviewResult } from '../../shared/types';
import {
  curateIssueCommentContext,
  type FetchAndFilterCommentsFn,
  type TriageCommentsFn,
} from './comment-context';

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
  extraArgs?: readonly string[];
  cwd?: string;
  curatedComments?: string;
  onChunk: (delta: string) => void;
  onStatus?: (status: string) => void;
}) => Promise<string>;

type PreflightClaudeRepoAccessFn = (input: { repoPath: string }) => Promise<void>;

export interface SpecGenerateDeps {
  store: ConfigStore;
  cache: IssuesCache;
  readRepoContext: (repoPath: string) => Promise<RepoContext>;
  streamSpec: StreamSpecFn;
  preflightClaudeRepoAccess?: PreflightClaudeRepoAccessFn;
  templateMd: string;
  fetchAndFilterComments: FetchAndFilterCommentsFn;
  triageComments: TriageCommentsFn;
  notifyDone?: NotifyDoneFn;
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
  status?: string,
): void {
  sender.send(IpcChannel.SpecStreamChunk, { issueId, delta, done, status });
}

function sendSpecPhase(
  sender: SpecGenerateEventSender,
  payload: { issueId: string; phase: 'triaging' | 'generating'; commentCount?: number },
): void {
  sender.send(IpcChannel.SpecPhase, payload);
}

async function curateSpecComments(
  deps: Pick<SpecGenerateDeps, 'fetchAndFilterComments' | 'triageComments'>,
  sender: SpecGenerateEventSender,
  issue: Issue,
): Promise<string> {
  return curateIssueCommentContext({
    deps,
    issue,
    emitPhase: (payload) => sendSpecPhase(sender, payload),
    logPrefix: '[spec]',
  });
}

function specRepoPath(cfg: { repoPath: string; computronRepoPath?: string }): string {
  const targetRepoPath = cfg.computronRepoPath?.trim();
  return targetRepoPath || cfg.repoPath;
}

function specExtraArgs(repoPath: string): readonly string[] {
  if (!repoPath) {
    return [];
  }

  return ['--add-dir', repoPath, '--allowedTools', 'Read,Glob,Grep'];
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
        const targetRepoPath = specRepoPath(cfg);
        const model = pickSpecModel(payload, cfg.claudeModel);
        const context = await deps.readRepoContext(targetRepoPath);
        const prompt = buildSpecPrompt({ issue, context, templateMd: deps.templateMd });
        const curated = await curateSpecComments(deps, event.sender, issue);
        sendSpecPhase(event.sender, { issueId: payload.issueId, phase: 'generating' });
        if (cfg.computronRepoPath && deps.preflightClaudeRepoAccess) {
          await deps.preflightClaudeRepoAccess({ repoPath: cfg.computronRepoPath });
        }
        const content = cleanSpecMarkdown(
          await deps.streamSpec({
            model,
            system: prompt.system,
            user: prompt.user,
            extraArgs: specExtraArgs(targetRepoPath),
            cwd: targetRepoPath || undefined,
            curatedComments: curated,
            onChunk: (delta) => sendSpecChunk(event.sender, payload.issueId, delta, false),
            onStatus: (status) => sendSpecChunk(event.sender, payload.issueId, '', false, status),
          }),
        );
        sendSpecChunk(event.sender, payload.issueId, '', true);
        event.sender.send(IpcChannel.SpecGenerateDone, { issueId: payload.issueId });
        notifyDoneBestEffort(
          deps.notifyDone ?? notifyDone,
          'Spec ready',
          `${payload.issueId} finished generating.`,
        );
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
