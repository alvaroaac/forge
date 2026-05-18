import { describe, it, expect } from 'vitest';
import { IpcChannel } from '../../src/shared/ipc-channels';

describe('IpcChannel', () => {
  it('exposes spec and app channels', () => {
    expect(IpcChannel.AuthCheck).toBe('auth:check');
    expect(IpcChannel.LinearFetchIssues).toBe('linear:fetch-issues');
    expect(IpcChannel.LinearFetchIssueDetail).toBe('linear:fetch-issue-detail');
    expect(IpcChannel.LinearFetchTeamTriage).toBe('linear:fetch-team-triage');
    expect(IpcChannel.LinearGetViewerId).toBe('linear:get-viewer-id');
    expect(IpcChannel.LinearRefresh).toBe('linear:refresh');
    expect(IpcChannel.SpecGenerate).toBe('spec:generate');
    expect(IpcChannel.SpecLaunchReview).toBe('spec:launch-review');
    expect(IpcChannel.SpecStreamChunk).toBe('spec:stream-chunk');
    expect(IpcChannel.SpecGenerateDone).toBe('spec:generate-done');
    expect(IpcChannel.SpecGenerateError).toBe('spec:generate-error');
    expect(IpcChannel.SpecGet).toBe('spec:get');
    expect(IpcChannel.SpecWrite).toBe('spec:write');
    expect(IpcChannel.TriageGenerate).toBe('triage:generate');
    expect(IpcChannel.TriageStreamChunk).toBe('triage:stream-chunk');
    expect(IpcChannel.TriageGenerateDone).toBe('triage:generate-done');
    expect(IpcChannel.TriageGenerateError).toBe('triage:generate-error');
    expect(IpcChannel.TriageGet).toBe('triage:get');
    expect(IpcChannel.TriageWrite).toBe('triage:write');
    expect(IpcChannel.ConfigGet).toBe('config:get');
    expect(IpcChannel.ConfigSet).toBe('config:set');
  });
});
