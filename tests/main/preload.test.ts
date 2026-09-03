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

  it('calls brief.generate through IpcChannel.BriefGenerate with issueId and optional model', async () => {
    const forge = getForgeApi();
    await forge.brief.generate('FUL-7');
    expect(invoke).toHaveBeenCalledWith(IpcChannel.BriefGenerate, {
      issueId: 'FUL-7',
      model: undefined,
    });
    await forge.brief.generate('FUL-7', 'opus');
    expect(invoke).toHaveBeenCalledWith(IpcChannel.BriefGenerate, {
      issueId: 'FUL-7',
      model: 'opus',
    });
  });

  it('calls brief.get through IpcChannel.BriefGet with issueId', async () => {
    const forge = getForgeApi();
    await forge.brief.get('FUL-7');
    expect(invoke).toHaveBeenCalledWith(IpcChannel.BriefGet, { issueId: 'FUL-7' });
  });

  it('calls comments.generateSummary through IpcChannel.CommentsGenerateSummary with issueId', async () => {
    const forge = getForgeApi();
    await forge.comments?.generateSummary('FUL-7');
    expect(invoke).toHaveBeenCalledWith(IpcChannel.CommentsGenerateSummary, {
      issueId: 'FUL-7',
    });
  });

  it('calls comments.fetch through IpcChannel.CommentsFetch with issueId', async () => {
    const forge = getForgeApi();
    await forge.comments?.fetch('FUL-7');
    expect(invoke).toHaveBeenCalledWith(IpcChannel.CommentsFetch, {
      issueId: 'FUL-7',
    });
  });

  it('calls brief.write through IpcChannel.BriefWrite with overwrite default false', async () => {
    const forge = getForgeApi();
    await forge.brief.write('FUL-7', 'hello');
    expect(invoke).toHaveBeenCalledWith(IpcChannel.BriefWrite, {
      issueId: 'FUL-7',
      content: 'hello',
      overwrite: false,
    });
    await forge.brief.write('FUL-7', 'hello', { overwrite: true });
    expect(invoke).toHaveBeenCalledWith(IpcChannel.BriefWrite, {
      issueId: 'FUL-7',
      content: 'hello',
      overwrite: true,
    });
  });

  it('subscribes to brief stream/done/error channels and unsubscribes', () => {
    const forge = getForgeApi();
    const onChunk = vi.fn();
    const onDone = vi.fn();
    const onError = vi.fn();

    const unsubscribeChunk = forge.brief.onChunk(onChunk);
    const unsubscribeDone = forge.brief.onDone(onDone);
    const unsubscribeError = forge.brief.onError(onError);

    const chunkHandler = on.mock.calls[0][1];
    const doneHandler = on.mock.calls[1][1];
    const errorHandler = on.mock.calls[2][1];

    expect(on).toHaveBeenNthCalledWith(1, IpcChannel.BriefStreamChunk, chunkHandler);
    expect(on).toHaveBeenNthCalledWith(2, IpcChannel.BriefGenerateDone, doneHandler);
    expect(on).toHaveBeenNthCalledWith(3, IpcChannel.BriefGenerateError, errorHandler);

    unsubscribeChunk();
    unsubscribeDone();
    unsubscribeError();

    expect(off).toHaveBeenCalledWith(IpcChannel.BriefStreamChunk, chunkHandler);
    expect(off).toHaveBeenCalledWith(IpcChannel.BriefGenerateDone, doneHandler);
    expect(off).toHaveBeenCalledWith(IpcChannel.BriefGenerateError, errorHandler);
  });

  it('exposes spec.onPhase as a function returning an unsubscribe', () => {
    const forge = getForgeApi();

    expect(typeof forge.spec.onPhase).toBe('function');
    const unsubscribe = forge.spec.onPhase(() => undefined);
    const phaseHandler = on.mock.calls[0][1];

    expect(typeof unsubscribe).toBe('function');
    expect(on).toHaveBeenCalledWith(IpcChannel.SpecPhase, phaseHandler);

    unsubscribe();

    expect(off).toHaveBeenCalledWith(IpcChannel.SpecPhase, phaseHandler);
  });

  it('exposes brief.onPhase as a function returning an unsubscribe', () => {
    const forge = getForgeApi();

    expect(typeof forge.brief.onPhase).toBe('function');
    const unsubscribe = forge.brief.onPhase(() => undefined);
    const phaseHandler = on.mock.calls[0][1];

    expect(typeof unsubscribe).toBe('function');
    expect(on).toHaveBeenCalledWith(IpcChannel.BriefPhase, phaseHandler);

    unsubscribe();

    expect(off).toHaveBeenCalledWith(IpcChannel.BriefPhase, phaseHandler);
  });
});
