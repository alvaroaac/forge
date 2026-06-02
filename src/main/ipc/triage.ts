import type { IpcMain } from 'electron';
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { IpcChannel } from '../../shared/ipc-channels';
import { assertSafeIssueId, isSafeIssueId } from '../lib/issue-id';
import type { ConfigStore } from '../services/config-store';
import type { LinearComment } from '../services/comment-fetcher';
import type { Issue, TriageBrief, TriageWriteResult } from '../../shared/types';

type TriageGenerateEventSender = {
  send: (channel: string, payload: unknown) => void;
};

type TriageGenerateEvent = {
  sender: TriageGenerateEventSender;
};

type TriageGeneratePayload = {
  issueId: string;
  model?: string;
};

type TriageWritePayload = {
  issueId: string;
  content: string;
  overwrite?: boolean;
};

type StreamTriageBrief = (input: {
  issue: Issue;
  computronRepoPath: string;
  model: string;
  curatedComments?: string;
  onChunk: (delta: string) => void;
  onStatus?: (status: string) => void;
}) => Promise<string>;

type FetchAndFilterCommentsFn = (issueUuid: string) => Promise<LinearComment[]>;
type TriageCommentsFn = (input: {
  issueTitle: string;
  issueDescription: string;
  comments: LinearComment[];
}) => Promise<string>;

export interface TriageGenerateDeps {
  store: ConfigStore;
  fetchTriageList: () => Promise<Issue[]>;
  streamTriageBrief: StreamTriageBrief;
  fetchAndFilterComments: FetchAndFilterCommentsFn;
  triageComments: TriageCommentsFn;
}

export interface TriageGetDeps {
  store: ConfigStore;
}

export interface TriageWriteDeps {
  store: ConfigStore;
  writeTriageBrief: (input: {
    repoPath: string;
    issueId: string;
    content: string;
    mode: 'create' | 'overwrite';
  }) => Promise<Omit<TriageWriteResult, 'issueId'>>;
}

function triageBriefPath(repoPath: string, issueId: string): string | null {
  if (!isSafeIssueId(issueId)) {
    return null;
  }

  return join(repoPath, 'thoughts', 'tasks', issueId, 'triage-brief.md');
}

function findTriageIssue(issues: Issue[], issueId: string): Issue {
  if (!isSafeIssueId(issueId)) {
    throw new Error(`Triage issue not found: ${issueId}`);
  }

  const found = issues.find((issue) => issue.id === issueId);
  if (!found) {
    throw new Error(`Triage issue not found: ${issueId}`);
  }

  return found;
}

function sendTriageChunk(
  sender: TriageGenerateEventSender,
  issueId: string,
  delta: string,
  done: boolean,
  status?: string,
): void {
  sender.send(IpcChannel.TriageStreamChunk, { issueId, delta, done, status });
}

function sendTriagePhase(
  sender: TriageGenerateEventSender,
  payload: { issueId: string; phase: 'triaging' | 'generating'; commentCount?: number },
): void {
  sender.send(IpcChannel.TriagePhase, payload);
}

function toBriefStatus(status: string): string {
  if (status === 'Claude is drafting the spec') {
    return 'Claude is drafting the brief';
  }

  return status;
}

async function curateTriageComments(
  deps: Pick<TriageGenerateDeps, 'fetchAndFilterComments' | 'triageComments'>,
  sender: TriageGenerateEventSender,
  issue: Issue,
): Promise<string> {
  if (!issue.uuid) {
    return '';
  }

  try {
    const comments = await deps.fetchAndFilterComments(issue.uuid);
    sendTriagePhase(sender, {
      issueId: issue.id,
      phase: 'triaging',
      commentCount: comments.length,
    });

    if (comments.length === 0) {
      return '';
    }

    return await deps.triageComments({
      issueTitle: issue.title,
      issueDescription: issue.description,
      comments,
    });
  } catch (err) {
    console.warn('[triage] comment context failed, proceeding without curated comments:', err);
    return '';
  }
}

export function registerTriageGenerateHandler(ipc: IpcMain, deps: TriageGenerateDeps): void {
  ipc.handle(
    IpcChannel.TriageGenerate,
    async (event: TriageGenerateEvent, payload: TriageGeneratePayload) => {
      try {
        const cfg = await deps.store.get();
        if (!cfg.computronRepoPath) {
          throw new Error('computronRepoPath is not configured');
        }

        const issues = await deps.fetchTriageList();
        const issue = findTriageIssue(issues, payload.issueId);
        const model = payload.model?.trim() || cfg.claudeModel;
        const curated = await curateTriageComments(deps, event.sender, issue);
        sendTriagePhase(event.sender, { issueId: payload.issueId, phase: 'generating' });
        const content = await deps.streamTriageBrief({
          issue,
          computronRepoPath: cfg.computronRepoPath,
          model,
          curatedComments: curated,
          onChunk: (delta) => sendTriageChunk(event.sender, payload.issueId, delta, false),
          onStatus: (status) =>
            sendTriageChunk(event.sender, payload.issueId, '', false, toBriefStatus(status)),
        });

        sendTriageChunk(event.sender, payload.issueId, '', true);
        event.sender.send(IpcChannel.TriageGenerateDone, { issueId: payload.issueId });
        return { content, issueId: payload.issueId };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        event.sender.send(IpcChannel.TriageGenerateError, { issueId: payload.issueId, message });
        throw error;
      }
    },
  );
}

export function registerTriageGetHandler(ipc: IpcMain, deps: TriageGetDeps): void {
  ipc.handle(
    IpcChannel.TriageGet,
    async (_event, payload: { issueId: string }): Promise<TriageBrief | null> => {
      const cfg = await deps.store.get();
      const target = triageBriefPath(cfg.repoPath, payload.issueId);
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

export function registerTriageWriteHandler(ipc: IpcMain, deps: TriageWriteDeps): void {
  ipc.handle(IpcChannel.TriageWrite, async (_event, payload: TriageWritePayload) => {
    assertSafeIssueId(payload.issueId);

    const cfg = await deps.store.get();
    const result = await deps.writeTriageBrief({
      repoPath: cfg.repoPath,
      issueId: payload.issueId,
      content: payload.content,
      mode: payload.overwrite ? 'overwrite' : 'create',
    });

    return { issueId: payload.issueId, ...result };
  });
}
