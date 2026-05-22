import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ForgeApi } from '../../src/shared/forge-api';
import { IpcChannel } from '../../src/shared/ipc-channels';

interface ElectronMock {
  exposeInMainWorld: (key: string, value: unknown) => void;
}

const invoke = vi.fn();
const on = vi.fn();
const off = vi.fn();

let exposedApi: unknown;

function getForgeApi(): ForgeApi {
  if (!exposedApi) {
    throw new Error('forge API was not exposed');
  }

  return exposedApi as ForgeApi;
}

vi.mock('electron', () => {
  const api: ElectronMock = {
    exposeInMainWorld: vi.fn((key, value) => {
      if (key === 'forge') {
        exposedApi = value;
      }
    }),
  };

  return {
    contextBridge: api,
    ipcRenderer: {
      invoke,
      on,
      off,
    },
  };
});

describe('preload API', () => {
  beforeAll(async () => {
    exposedApi = null;
    await import('../../src/main/preload');
    expect(exposedApi).toBeDefined();
  });

  beforeEach(() => {
    invoke.mockClear();
    on.mockClear();
    off.mockClear();
  });

  it('calls linear.fetchTeamTriage through IpcChannel.LinearFetchTeamTriage', async () => {
    const forge = getForgeApi();
    await forge.linear.fetchTeamTriage();
    expect(invoke).toHaveBeenCalledWith(IpcChannel.LinearFetchTeamTriage);
  });

  it('calls linear.getViewerId through IpcChannel.LinearGetViewerId', async () => {
    const forge = getForgeApi();
    await forge.linear.getViewerId();
    expect(invoke).toHaveBeenCalledWith(IpcChannel.LinearGetViewerId);
  });

  it('calls triage.generate through IpcChannel.TriageGenerate with issueId and optional model', async () => {
    const forge = getForgeApi();
    await forge.triage.generate('FUL-7');
    expect(invoke).toHaveBeenCalledWith(IpcChannel.TriageGenerate, {
      issueId: 'FUL-7',
      model: undefined,
    });
    await forge.triage.generate('FUL-7', 'opus');
    expect(invoke).toHaveBeenCalledWith(IpcChannel.TriageGenerate, {
      issueId: 'FUL-7',
      model: 'opus',
    });
  });

  it('calls triage.get through IpcChannel.TriageGet with issueId', async () => {
    const forge = getForgeApi();
    await forge.triage.get('FUL-7');
    expect(invoke).toHaveBeenCalledWith(IpcChannel.TriageGet, { issueId: 'FUL-7' });
  });

  it('calls triage.write through IpcChannel.TriageWrite with overwrite default false', async () => {
    const forge = getForgeApi();
    await forge.triage.write('FUL-7', 'hello');
    expect(invoke).toHaveBeenCalledWith(IpcChannel.TriageWrite, {
      issueId: 'FUL-7',
      content: 'hello',
      overwrite: false,
    });
    await forge.triage.write('FUL-7', 'hello', { overwrite: true });
    expect(invoke).toHaveBeenCalledWith(IpcChannel.TriageWrite, {
      issueId: 'FUL-7',
      content: 'hello',
      overwrite: true,
    });
  });

  it('subscribes to triage stream/done/error channels and unsubscribes', () => {
    const forge = getForgeApi();
    const onChunk = vi.fn();
    const onDone = vi.fn();
    const onError = vi.fn();

    const unsubscribeChunk = forge.triage.onChunk(onChunk);
    const unsubscribeDone = forge.triage.onDone(onDone);
    const unsubscribeError = forge.triage.onError(onError);

    const chunkHandler = on.mock.calls[0][1];
    const doneHandler = on.mock.calls[1][1];
    const errorHandler = on.mock.calls[2][1];

    expect(on).toHaveBeenNthCalledWith(1, IpcChannel.TriageStreamChunk, chunkHandler);
    expect(on).toHaveBeenNthCalledWith(2, IpcChannel.TriageGenerateDone, doneHandler);
    expect(on).toHaveBeenNthCalledWith(3, IpcChannel.TriageGenerateError, errorHandler);

    unsubscribeChunk();
    unsubscribeDone();
    unsubscribeError();

    expect(off).toHaveBeenCalledWith(IpcChannel.TriageStreamChunk, chunkHandler);
    expect(off).toHaveBeenCalledWith(IpcChannel.TriageGenerateDone, doneHandler);
    expect(off).toHaveBeenCalledWith(IpcChannel.TriageGenerateError, errorHandler);
  });

  it('exposes spec.onPhase as a function returning an unsubscribe', () => {
    const forge = getForgeApi();

    expect(typeof forge.spec.onPhase).toBe('function');
    const onPhase = forge.spec.onPhase;
    if (!onPhase) {
      throw new Error('spec.onPhase was not exposed');
    }

    const unsubscribe = onPhase(() => undefined);
    const phaseHandler = on.mock.calls[0][1];

    expect(typeof unsubscribe).toBe('function');
    expect(on).toHaveBeenCalledWith(IpcChannel.SpecPhase, phaseHandler);

    unsubscribe();

    expect(off).toHaveBeenCalledWith(IpcChannel.SpecPhase, phaseHandler);
  });

  it('exposes triage.onPhase as a function returning an unsubscribe', () => {
    const forge = getForgeApi();

    expect(typeof forge.triage.onPhase).toBe('function');
    const onPhase = forge.triage.onPhase;
    if (!onPhase) {
      throw new Error('triage.onPhase was not exposed');
    }

    const unsubscribe = onPhase(() => undefined);
    const phaseHandler = on.mock.calls[0][1];

    expect(typeof unsubscribe).toBe('function');
    expect(on).toHaveBeenCalledWith(IpcChannel.TriagePhase, phaseHandler);

    unsubscribe();

    expect(off).toHaveBeenCalledWith(IpcChannel.TriagePhase, phaseHandler);
  });
});
