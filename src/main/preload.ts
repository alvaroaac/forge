import { contextBridge, ipcRenderer } from 'electron';
import { IpcChannel } from '../shared/ipc-channels';
import type { ForgeApi } from '../shared/forge-api';
import type { SpecStreamChunk } from '../shared/types';

const api: ForgeApi = {
  auth: {
    check: () => ipcRenderer.invoke(IpcChannel.AuthCheck),
  },
  linear: {
    fetch: () => ipcRenderer.invoke(IpcChannel.LinearFetchIssues),
    refresh: () => ipcRenderer.invoke(IpcChannel.LinearRefresh),
  },
  spec: {
    get: (issueId) => ipcRenderer.invoke(IpcChannel.SpecGet, { issueId }),
    generate: (issueId) => ipcRenderer.invoke(IpcChannel.SpecGenerate, { issueId }),
    onChunk: (handler) => {
      const listener = (_e: unknown, chunk: SpecStreamChunk) => handler(chunk);
      ipcRenderer.on(IpcChannel.SpecStreamChunk, listener);
      return () => ipcRenderer.off(IpcChannel.SpecStreamChunk, listener);
    },
  },
  config: {
    get: () => ipcRenderer.invoke(IpcChannel.ConfigGet),
    set: (patch) => ipcRenderer.invoke(IpcChannel.ConfigSet, patch),
  },
};

contextBridge.exposeInMainWorld('forge', api);
