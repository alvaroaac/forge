import { contextBridge, ipcRenderer } from 'electron';
import { IpcChannel } from '../shared/ipc-channels';
import type { ForgeApi } from '../shared/forge-api';
import type {
  SpecGenerateDone,
  SpecGenerateError,
  SpecPhaseEvent,
  SpecStreamChunk,
  BriefGenerateDone,
  BriefGenerateError,
  BriefPhaseEvent,
  BriefStreamChunk,
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
  brief: {
    get: (issueId) => ipcRenderer.invoke(IpcChannel.BriefGet, { issueId }),
    generate: (issueId, model) => ipcRenderer.invoke(IpcChannel.BriefGenerate, { issueId, model }),
    write: (issueId, content, opts) =>
      ipcRenderer.invoke(IpcChannel.BriefWrite, {
        issueId,
        content,
        overwrite: opts?.overwrite ?? false,
      }),
    onChunk: (handler) => subscribe<BriefStreamChunk>(IpcChannel.BriefStreamChunk, handler),
    onDone: (handler) => subscribe<BriefGenerateDone>(IpcChannel.BriefGenerateDone, handler),
    onError: (handler) => {
      return subscribe<BriefGenerateError>(IpcChannel.BriefGenerateError, handler);
    },
    onPhase: (handler) => subscribe<BriefPhaseEvent>(IpcChannel.BriefPhase, handler),
  },
  comments: {
    fetch: (issueId) => ipcRenderer.invoke(IpcChannel.CommentsFetch, { issueId }),
    generateSummary: (issueId) =>
      ipcRenderer.invoke(IpcChannel.CommentsGenerateSummary, { issueId }),
  },
  config: {
    get: () => ipcRenderer.invoke(IpcChannel.ConfigGet),
    set: (patch) => ipcRenderer.invoke(IpcChannel.ConfigSet, patch),
  },
};

contextBridge.exposeInMainWorld('forge', api);
