import type { IpcMain } from 'electron';
import { IpcChannel } from '../../shared/ipc-channels';
import { assertSafeIssueId, isSafeIssueId } from '../lib/issue-id';
import type { ConfigStore } from '../services/config-store';
import type { Issue, TriageWriteResult } from '../../shared/types';

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
  onChunk: (delta: string) => void;
}) => Promise<string>;

export interface TriageGenerateDeps {
  store: ConfigStore;
  fetchTriageList: () => Promise<Issue[]>;
  streamTriageBrief: StreamTriageBrief;
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
): void {
  sender.send(IpcChannel.TriageStreamChunk, { issueId, delta, done });
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
        const content = await deps.streamTriageBrief({
          issue,
          computronRepoPath: cfg.computronRepoPath,
          model,
          onChunk: (delta) => sendTriageChunk(event.sender, payload.issueId, delta, false),
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

export function registerTriageWriteHandler(ipc: IpcMain, deps: TriageWriteDeps): void {
  ipc.handle(
    IpcChannel.TriageWrite,
    async (_event, payload: TriageWritePayload) => {
      assertSafeIssueId(payload.issueId);

      const cfg = await deps.store.get();
      const result = await deps.writeTriageBrief({
        repoPath: cfg.repoPath,
        issueId: payload.issueId,
        content: payload.content,
        mode: payload.overwrite ? 'overwrite' : 'create',
      });

      return { issueId: payload.issueId, ...result };
    },
  );
}
