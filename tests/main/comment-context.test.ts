import { describe, expect, it, vi } from 'vitest';

import {
  curateIssueCommentContext,
  type CommentContextDeps,
} from '../../src/main/ipc/comment-context';
import type { LinearComment } from '../../src/main/services/comment-fetcher';
import type { Issue } from '../../src/shared/types';

const issue: Issue = {
  id: 'FUL-77',
  uuid: 'uuid-77',
  title: 'Build the thing',
  description: 'Needs context.',
  status: 'todo',
  priority: 'medium',
  labels: [],
  url: 'https://linear.app/example/issue/FUL-77',
  updatedAt: '2026-06-02T00:00:00.000Z',
  isBug: false,
  assigneeId: null,
};

const comment: LinearComment = {
  id: 'comment-1',
  body: 'Reporter clarified the edge case.',
  createdAt: '2026-06-02T00:00:00.000Z',
  authorName: 'Alice',
  isBot: false,
};

function createDeps(overrides: Partial<CommentContextDeps> = {}): CommentContextDeps {
  return {
    fetchAndFilterComments: vi.fn().mockResolvedValue([]),
    triageComments: vi.fn().mockResolvedValue(''),
    ...overrides,
  };
}

describe('curateIssueCommentContext', () => {
  it('returns empty context without fetching when the issue has no UUID', async () => {
    const deps = createDeps();
    const emitPhase = vi.fn();

    const result = await curateIssueCommentContext({
      deps,
      issue: { ...issue, uuid: undefined as unknown as string },
      emitPhase,
      logPrefix: '[test]',
    });

    expect(result).toBe('');
    expect(deps.fetchAndFilterComments).not.toHaveBeenCalled();
    expect(deps.triageComments).not.toHaveBeenCalled();
    expect(emitPhase).not.toHaveBeenCalled();
  });

  it('emits commentCount 0 and returns empty context without calling the comment triager', async () => {
    const deps = createDeps({
      fetchAndFilterComments: vi.fn().mockResolvedValue([]),
    });
    const emitPhase = vi.fn();

    const result = await curateIssueCommentContext({
      deps,
      issue,
      emitPhase,
      logPrefix: '[test]',
    });

    expect(result).toBe('');
    expect(deps.fetchAndFilterComments).toHaveBeenCalledWith('uuid-77');
    expect(deps.triageComments).not.toHaveBeenCalled();
    expect(emitPhase).toHaveBeenCalledWith({
      issueId: 'FUL-77',
      phase: 'triaging',
      commentCount: 0,
    });
  });

  it('emits commentCount and returns curated context when comments exist', async () => {
    const deps = createDeps({
      fetchAndFilterComments: vi.fn().mockResolvedValue([comment]),
      triageComments: vi.fn().mockResolvedValue('CURATED'),
    });
    const emitPhase = vi.fn();

    const result = await curateIssueCommentContext({
      deps,
      issue,
      emitPhase,
      logPrefix: '[test]',
    });

    expect(result).toBe('CURATED');
    expect(emitPhase).toHaveBeenCalledWith({
      issueId: 'FUL-77',
      phase: 'triaging',
      commentCount: 1,
    });
    expect(deps.triageComments).toHaveBeenCalledWith({
      issueTitle: 'Build the thing',
      issueDescription: 'Needs context.',
      comments: [comment],
    });
  });

  it('fails open when comment fetching fails', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const deps = createDeps({
      fetchAndFilterComments: vi.fn().mockRejectedValue(new Error('Linear is down')),
      triageComments: vi.fn().mockResolvedValue('CURATED'),
    });
    const emitPhase = vi.fn();

    const result = await curateIssueCommentContext({
      deps,
      issue,
      emitPhase,
      logPrefix: '[test]',
    });

    expect(result).toBe('');
    expect(deps.triageComments).not.toHaveBeenCalled();
    expect(emitPhase).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      '[test] comment context failed, proceeding without curated comments:',
      expect.any(Error),
    );
    warnSpy.mockRestore();
  });

  it('fails open when comment triage fails', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const deps = createDeps({
      fetchAndFilterComments: vi.fn().mockResolvedValue([comment]),
      triageComments: vi.fn().mockRejectedValue(new Error('Claude timed out')),
    });
    const emitPhase = vi.fn();

    const result = await curateIssueCommentContext({
      deps,
      issue,
      emitPhase,
      logPrefix: '[test]',
    });

    expect(result).toBe('');
    expect(emitPhase).toHaveBeenCalledWith({
      issueId: 'FUL-77',
      phase: 'triaging',
      commentCount: 1,
    });
    expect(warnSpy).toHaveBeenCalledWith(
      '[test] comment context failed, proceeding without curated comments:',
      expect.any(Error),
    );
    warnSpy.mockRestore();
  });
});
