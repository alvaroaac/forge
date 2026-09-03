import type { IpcMain } from 'electron';
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { IpcChannel } from '../../shared/ipc-channels';
import { assertSafeIssueId, isSafeIssueId } from '../lib/issue-id';
import type { ConfigStore } from '../services/config-store';
import { notifyDone, notifyDoneBestEffort, type NotifyDoneFn } from '../services/notifications';
import type { Issue, GeneratedBrief, BriefWriteResult } from '../../shared/types';
import {
  curateIssueCommentContext,
  type FetchAndFilterCommentsFn,
  type TriageCommentsFn,
} from './comment-context';

type BriefGenerateEventSender = {
  send: (channel: string, payload: unknown) => void;
};

type BriefGenerateEvent = {
  sender: BriefGenerateEventSender;
};

type BriefGeneratePayload = {
  issueId: string;
  model?: string;
};

type BriefWritePayload = {
  issueId: string;
  content: string;
  overwrite?: boolean;
};

type StreamBrief = (input: {
  issue: Issue;
  computronRepoPath: string;
  model: string;
  curatedComments?: string;
  onChunk: (delta: string) => void;
  onStatus?: (status: string) => void;
}) => Promise<string>;

export interface BriefGenerateDeps {
  store: ConfigStore;
  fetchTriageList: () => Promise<Issue[]>;
  streamBrief: StreamBrief;
  fetchAndFilterComments: FetchAndFilterCommentsFn;
  triageComments: TriageCommentsFn;
  notifyDone?: NotifyDoneFn;
}

export interface BriefGetDeps {
  store: ConfigStore;
}

export interface BriefWriteDeps {
  store: ConfigStore;
  writeBrief: (input: {
    repoPath: string;
    issueId: string;
    content: string;
    mode: 'create' | 'overwrite';
  }) => Promise<Omit<BriefWriteResult, 'issueId'>>;
}

function briefFilePath(repoPath: string, issueId: string): string | null {
  if (!isSafeIssueId(issueId)) {
    return null;
  }

  return join(repoPath, 'thoughts', 'tasks', issueId, 'brief.md');
}

function findBriefIssue(issues: Issue[], issueId: string): Issue {
  if (!isSafeIssueId(issueId)) {
    throw new Error(`Brief issue not found: ${issueId}`);
  }

  const found = issues.find((issue) => issue.id === issueId);
  if (!found) {
    throw new Error(`Brief issue not found: ${issueId}`);
  }

  return found;
}

function sendBriefChunk(
  sender: BriefGenerateEventSender,
  issueId: string,
  delta: string,
  done: boolean,
  status?: string,
): void {
  sender.send(IpcChannel.BriefStreamChunk, { issueId, delta, done, status });
}

function sendBriefPhase(
  sender: BriefGenerateEventSender,
  payload: { issueId: string; phase: 'triaging' | 'generating'; commentCount?: number },
): void {
  sender.send(IpcChannel.BriefPhase, payload);
}

function toBriefStatus(status: string): string {
  if (status === 'Claude is drafting the spec') {
    return 'Claude is drafting the brief';
  }

  return status;
}

async function curateBriefComments(
  deps: Pick<BriefGenerateDeps, 'fetchAndFilterComments' | 'triageComments'>,
  sender: BriefGenerateEventSender,
  issue: Issue,
): Promise<string> {
  return curateIssueCommentContext({
    deps,
    issue,
    emitPhase: (payload) => sendBriefPhase(sender, payload),
    logPrefix: '[brief]',
  });
}

export function registerBriefGenerateHandler(ipc: IpcMain, deps: BriefGenerateDeps): void {
  ipc.handle(
    IpcChannel.BriefGenerate,
    async (event: BriefGenerateEvent, payload: BriefGeneratePayload) => {
      try {
        const cfg = await deps.store.get();
        if (!cfg.computronRepoPath) {
          throw new Error('computronRepoPath is not configured');
        }

        const issues = await deps.fetchTriageList();
        const issue = findBriefIssue(issues, payload.issueId);
        const model = payload.model?.trim() || cfg.claudeModel;
        const curated = await curateBriefComments(deps, event.sender, issue);
        sendBriefPhase(event.sender, { issueId: payload.issueId, phase: 'generating' });
        const content = await deps.streamBrief({
          issue,
          computronRepoPath: cfg.computronRepoPath,
          model,
          curatedComments: curated,
          onChunk: (delta) => sendBriefChunk(event.sender, payload.issueId, delta, false),
          onStatus: (status) =>
            sendBriefChunk(event.sender, payload.issueId, '', false, toBriefStatus(status)),
        });

        sendBriefChunk(event.sender, payload.issueId, '', true);
        event.sender.send(IpcChannel.BriefGenerateDone, { issueId: payload.issueId });
        notifyDoneBestEffort(
          deps.notifyDone ?? notifyDone,
          'Brief ready',
          `${payload.issueId} finished generating.`,
        );
        return { content, issueId: payload.issueId };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        event.sender.send(IpcChannel.BriefGenerateError, { issueId: payload.issueId, message });
        throw error;
      }
    },
  );
}

export function registerBriefGetHandler(ipc: IpcMain, deps: BriefGetDeps): void {
  ipc.handle(
    IpcChannel.BriefGet,
    async (_event, payload: { issueId: string }): Promise<GeneratedBrief | null> => {
      const cfg = await deps.store.get();
      const target = briefFilePath(cfg.repoPath, payload.issueId);
      if (!target) {
        return null;
      }

      try {
        const fileStat = await stat(target);
        const content = await readFile(target, 'utf-8');
        return {
          issueId: payload.issueId,
          content,
          generatedAt: fileStat.mtime.toISOString(),
        };
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          return null;
        }

        throw error;
      }
    },
  );
}

export function registerBriefWriteHandler(ipc: IpcMain, deps: BriefWriteDeps): void {
  ipc.handle(IpcChannel.BriefWrite, async (_event, payload: BriefWritePayload) => {
    assertSafeIssueId(payload.issueId);

    const cfg = await deps.store.get();
    const result = await deps.writeBrief({
      repoPath: cfg.repoPath,
      issueId: payload.issueId,
      content: payload.content,
      mode: payload.overwrite ? 'overwrite' : 'create',
    });

    return { issueId: payload.issueId, ...result };
  });
}
