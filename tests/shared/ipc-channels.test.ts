import { describe, it, expect } from 'vitest';
import { IpcChannel } from '../../src/shared/ipc-channels';

describe('IpcChannel', () => {
  it('exposes Phase 1 channels', () => {
    expect(IpcChannel.AuthCheck).toBe('auth:check');
    expect(IpcChannel.LinearFetchIssues).toBe('linear:fetch-issues');
    expect(IpcChannel.LinearRefresh).toBe('linear:refresh');
    expect(IpcChannel.SpecGenerate).toBe('spec:generate');
    expect(IpcChannel.SpecStreamChunk).toBe('spec:stream-chunk');
    expect(IpcChannel.SpecGet).toBe('spec:get');
    expect(IpcChannel.ConfigGet).toBe('config:get');
    expect(IpcChannel.ConfigSet).toBe('config:set');
  });
});
