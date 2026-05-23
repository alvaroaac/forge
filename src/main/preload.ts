import { contextBridge, ipcRenderer } from 'electron';
import { IpcChannel } from '../shared/ipc-channels';
import type { ForgeApi } from '../shared/forge-api';
import type {
  SpecGenerateDone,
  SpecGenerateError,
  SpecPhaseEvent,
  SpecStreamChunk,
  TriageGenerateDone,
  TriageGenerateError,
  TriagePhaseEvent,
  TriageStreamChunk,
} from '../shared/types';

function subscribe<T>(channel: string, handler: (payload: T) => void): () => void {
  const listener = (_e: unknown, payload: T) => handler(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.off(channel, listener);
}

const api: ForgeApi = {
  auth: {
    check: () => ipcRenderer.invoke(IpcChannel.AuthCheck),
  },
  linear: {
    fetch: () => ipcRenderer.invoke(IpcChannel.LinearFetchIssues),
    fetchIssueDetail: (issueId) =>
      ipcRenderer.invoke(IpcChannel.LinearFetchIssueDetail, { issueId }),
    refresh: () => ipcRenderer.invoke(IpcChannel.LinearRefresh),
    fetchTeamTriage: () => ipcRenderer.invoke(IpcChannel.LinearFetchTeamTriage),
    getViewerId: () => ipcRenderer.invoke(IpcChannel.LinearGetViewerId),
  },
  spec: {
    get: (issueId) => ipcRenderer.invoke(IpcChannel.SpecGet, { issueId }),
    generate: (issueId, model) => ipcRenderer.invoke(IpcChannel.SpecGenerate, { issueId, model }),
    write: (issueId, content) => ipcRenderer.invoke(IpcChannel.SpecWrite, { issueId, content }),
    launchReview: (issueId, content, model) =>
      ipcRenderer.invoke(IpcChannel.SpecLaunchReview, { issueId, content, model }),
    onChunk: (handler) => {
      return subscribe<SpecStreamChunk>(IpcChannel.SpecStreamChunk, handler);
    },
    onDone: (handler) => {
      return subscribe<SpecGenerateDone>(IpcChannel.SpecGenerateDone, handler);
    },
    onError: (handler) => {
      return subscribe<SpecGenerateError>(IpcChannel.SpecGenerateError, handler);
    },
    onPhase: (handler) => subscribe<SpecPhaseEvent>(IpcChannel.SpecPhase, handler),
  },
  triage: {
    get: (issueId) => ipcRenderer.invoke(IpcChannel.TriageGet, { issueId }),
    generate: (issueId, model) => ipcRenderer.invoke(IpcChannel.TriageGenerate, { issueId, model }),
    write: (issueId, content, opts) =>
      ipcRenderer.invoke(IpcChannel.TriageWrite, {
        issueId,
        content,
        overwrite: opts?.overwrite ?? false,
      }),
    onChunk: (handler) => subscribe<TriageStreamChunk>(IpcChannel.TriageStreamChunk, handler),
    onDone: (handler) => subscribe<TriageGenerateDone>(IpcChannel.TriageGenerateDone, handler),
    onError: (handler) => {
      return subscribe<TriageGenerateError>(IpcChannel.TriageGenerateError, handler);
    },
    onPhase: (handler) => subscribe<TriagePhaseEvent>(IpcChannel.TriagePhase, handler),
  },
  comments: {
    fetch: (issueId, issue) => ipcRenderer.invoke(IpcChannel.CommentsFetch, { issueId, issue }),
    generateSummary: (issueId, issue, comments) =>
      ipcRenderer.invoke(IpcChannel.CommentsGenerateSummary, { issueId, issue, comments }),
  },
  config: {
    get: () => ipcRenderer.invoke(IpcChannel.ConfigGet),
    set: (patch) => ipcRenderer.invoke(IpcChannel.ConfigSet, patch),
  },
};

contextBridge.exposeInMainWorld('forge', api);
