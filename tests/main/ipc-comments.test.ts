import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IpcMain } from 'electron';
import { IpcChannel, type IpcChannelName } from '../../src/shared/ipc-channels';
import {
  registerCommentsFetchHandler,
  registerCommentsGenerateSummaryHandler,
} from '../../src/main/ipc/comments';
import type { CommentFetchResult, CommentSummaryResult, Issue } from '../../src/shared/types';

type IpcMainHandler = (_event: unknown, payload: unknown) => Promise<unknown>;

class IpcMainDouble {
  readonly calls = new Map<IpcChannelName, IpcMainHandler>();

  handle(channel: IpcChannelName, listener: IpcMainHandler): void {
    this.calls.set(channel, listener);
  }

  invoke(channel: IpcChannelName, payload: unknown): Promise<unknown> {
    const handler = this.calls.get(channel);
    if (!handler) {
      throw new Error(`No handler for ${channel}`);
    }

    return handler({}, payload);
  }
}

const issue: Issue = {
  id: 'FUL-7',
  uuid: 'uuid-7',
  title: 'Pipe comments into generation',
  description: 'Need a manual comment summary.',
  status: 'todo',
  priority: 'high',
  labels: ['ux'],
  url: 'https://linear.app/acme/issue/FUL-7',
  updatedAt: '2026-05-20T00:00:00.000Z',
  isBug: false,
  assigneeId: null,
};

describe('registerCommentsGenerateSummaryHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches raw filtered comments and generates a manual summary for the cached issue', async () => {
    const ipc = new IpcMainDouble();
    const comments = [
      {
        id: 'comment-1',
        body: 'Please include the migration caveat.',
        createdAt: '2026-05-20T12:00:00.000Z',
        authorName: 'Alice',
        isBot: false,
      },
    ];
    const fetchAndFilterComments = vi.fn().mockResolvedValue(comments);
    const triageComments = vi.fn().mockResolvedValue('## Useful context\nMigration caveat.');

    registerCommentsGenerateSummaryHandler(ipc as unknown as IpcMain, {
      cache: { read: vi.fn().mockResolvedValue([issue]) },
      fetchAndFilterComments,
      triageComments,
    });

    const result = (await ipc.invoke(IpcChannel.CommentsGenerateSummary, {
      issueId: 'FUL-7',
    })) as CommentSummaryResult;

    expect(fetchAndFilterComments).toHaveBeenCalledWith('uuid-7');
    expect(triageComments).toHaveBeenCalledWith({
      issueTitle: issue.title,
      issueDescription: issue.description,
      comments,
    });
    expect(result).toEqual({
      issueId: 'FUL-7',
      comments,
      commentCount: 1,
      summary: '## Useful context\nMigration caveat.',
    });
  });

  it('returns raw comments with an error message when summarization fails', async () => {
    const ipc = new IpcMainDouble();
    const comments = [
      {
        id: 'comment-1',
        body: 'Do not lose this comment.',
        createdAt: '2026-05-20T12:00:00.000Z',
        authorName: 'Alice',
        isBot: false,
      },
    ];

    registerCommentsGenerateSummaryHandler(ipc as unknown as IpcMain, {
      cache: { read: vi.fn().mockResolvedValue([issue]) },
      fetchAndFilterComments: vi.fn().mockResolvedValue(comments),
      triageComments: vi.fn().mockRejectedValue(new Error('model timed out')),
    });

    await expect(
      ipc.invoke(IpcChannel.CommentsGenerateSummary, { issueId: 'FUL-7' }),
    ).resolves.toMatchObject({
      issueId: 'FUL-7',
      comments,
      commentCount: 1,
      summary: '',
      errorMessage: 'model timed out',
    });
  });

  it('does not fetch comments when a stale cached issue has no uuid', async () => {
    const ipc = new IpcMainDouble();
    const staleIssue = { ...issue, uuid: '' };
    const fetchAndFilterComments = vi.fn();

    registerCommentsGenerateSummaryHandler(ipc as unknown as IpcMain, {
      cache: { read: vi.fn().mockResolvedValue([staleIssue]) },
      fetchAndFilterComments,
      triageComments: vi.fn(),
    });

    await expect(
      ipc.invoke(IpcChannel.CommentsGenerateSummary, { issueId: 'FUL-7' }),
    ).resolves.toEqual({
      issueId: 'FUL-7',
      comments: [],
      commentCount: 0,
      summary: '',
      skippedReason: 'missing-uuid',
    });
    expect(fetchAndFilterComments).not.toHaveBeenCalled();
  });

  it('uses a renderer-provided issue snapshot when the issue is not in the assigned cache', async () => {
    const ipc = new IpcMainDouble();
    const fetchAndFilterComments = vi.fn().mockResolvedValue([
      {
        id: 'comment-1',
        body: 'Triage-only context',
        createdAt: '2026-05-20T12:00:00.000Z',
        authorName: 'Alice',
        isBot: false,
      },
    ]);

    registerCommentsGenerateSummaryHandler(ipc as unknown as IpcMain, {
      cache: { read: vi.fn().mockResolvedValue([]) },
      fetchAndFilterComments,
      triageComments: vi.fn().mockResolvedValue('Triage-only summary'),
    });

    await expect(
      ipc.invoke(IpcChannel.CommentsGenerateSummary, { issueId: 'FUL-7', issue }),
    ).resolves.toMatchObject({
      issueId: 'FUL-7',
      commentCount: 1,
      summary: 'Triage-only summary',
    });
    expect(fetchAndFilterComments).toHaveBeenCalledWith('uuid-7');
  });

  it('uses provided comments for summary generation without fetching comments again', async () => {
    const ipc = new IpcMainDouble();
    const comments = [
      {
        id: 'comment-1',
        body: 'Already fetched context',
        createdAt: '2026-05-20T12:00:00.000Z',
        authorName: 'Alice',
        isBot: false,
      },
    ];
    const fetchAndFilterComments = vi.fn();
    const triageComments = vi.fn().mockResolvedValue('Summary from provided comments');

    registerCommentsGenerateSummaryHandler(ipc as unknown as IpcMain, {
      cache: { read: vi.fn().mockResolvedValue([issue]) },
      fetchAndFilterComments,
      triageComments,
    });

    await expect(
      ipc.invoke(IpcChannel.CommentsGenerateSummary, {
        issueId: 'FUL-7',
        comments,
      }),
    ).resolves.toMatchObject({
      issueId: 'FUL-7',
      comments,
      commentCount: 1,
      summary: 'Summary from provided comments',
    });
    expect(fetchAndFilterComments).not.toHaveBeenCalled();
  });
});

describe('registerCommentsFetchHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches raw filtered comments for the cached issue', async () => {
    const ipc = new IpcMainDouble();
    const comments = [
      {
        id: 'comment-1',
        body: 'Raw context',
        createdAt: '2026-05-20T12:00:00.000Z',
        authorName: 'Alice',
        isBot: false,
      },
    ];
    const fetchAndFilterComments = vi.fn().mockResolvedValue(comments);

    registerCommentsFetchHandler(ipc as unknown as IpcMain, {
      cache: { read: vi.fn().mockResolvedValue([issue]) },
      fetchAndFilterComments,
    });

    const result = (await ipc.invoke(IpcChannel.CommentsFetch, {
      issueId: 'FUL-7',
    })) as CommentFetchResult;

    expect(fetchAndFilterComments).toHaveBeenCalledWith('uuid-7');
    expect(result).toEqual({
      issueId: 'FUL-7',
      comments,
      commentCount: 1,
    });
  });

  it('returns no-comments when the issue has no human comments', async () => {
    const ipc = new IpcMainDouble();

    registerCommentsFetchHandler(ipc as unknown as IpcMain, {
      cache: { read: vi.fn().mockResolvedValue([issue]) },
      fetchAndFilterComments: vi.fn().mockResolvedValue([]),
    });

    await expect(ipc.invoke(IpcChannel.CommentsFetch, { issueId: 'FUL-7' })).resolves.toEqual({
      issueId: 'FUL-7',
      comments: [],
      commentCount: 0,
      skippedReason: 'no-comments',
    });
  });
});
