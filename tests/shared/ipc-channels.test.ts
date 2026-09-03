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
    expect(IpcChannel.CommentsFetch).toBe('comments:fetch');
    expect(IpcChannel.CommentsGenerateSummary).toBe('comments:generate-summary');
    expect(IpcChannel.SpecGenerate).toBe('spec:generate');
    expect(IpcChannel.SpecLaunchReview).toBe('spec:launch-review');
    expect(IpcChannel.SpecStreamChunk).toBe('spec:stream-chunk');
    expect(IpcChannel.SpecGenerateDone).toBe('spec:generate-done');
    expect(IpcChannel.SpecGenerateError).toBe('spec:generate-error');
    expect(IpcChannel.SpecPhase).toBe('spec:phase');
    expect(IpcChannel.SpecGet).toBe('spec:get');
    expect(IpcChannel.SpecWrite).toBe('spec:write');
    expect(IpcChannel.BriefGenerate).toBe('brief:generate');
    expect(IpcChannel.BriefStreamChunk).toBe('brief:stream-chunk');
    expect(IpcChannel.BriefGenerateDone).toBe('brief:generate-done');
    expect(IpcChannel.BriefGenerateError).toBe('brief:generate-error');
    expect(IpcChannel.BriefPhase).toBe('brief:phase');
    expect(IpcChannel.BriefGet).toBe('brief:get');
    expect(IpcChannel.BriefWrite).toBe('brief:write');
    expect(IpcChannel.ConfigGet).toBe('config:get');
    expect(IpcChannel.ConfigSet).toBe('config:set');
  });
});
