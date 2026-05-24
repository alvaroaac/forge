import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

import type { Issue } from '../../src/shared/types';
import { CommentsTab } from '../../src/renderer/components/comments-tab';

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });

  return { promise, resolve };
}

const issueA: Issue = {
  id: 'FUL-7',
  uuid: 'uuid-7',
  title: 'First issue',
  description: 'First description',
  status: 'todo',
  priority: 'high',
  labels: [],
  url: 'https://linear.app/acme/issue/FUL-7',
  updatedAt: '2026-05-20T00:00:00.000Z',
  isBug: false,
  assigneeId: null,
};

const issueB: Issue = {
  ...issueA,
  id: 'FUL-8',
  uuid: 'uuid-8',
  title: 'Second issue',
  description: 'Second description',
  url: 'https://linear.app/acme/issue/FUL-8',
};

function setCommentsApi({
  fetch = vi.fn().mockResolvedValue({
    issueId: 'FUL-7',
    comments: [],
    commentCount: 0,
    skippedReason: 'no-comments',
  }),
  generateSummary = vi.fn(),
}: {
  fetch?: ReturnType<typeof vi.fn>;
  generateSummary?: ReturnType<typeof vi.fn>;
}) {
  window.forge = {
    auth: { check: vi.fn() },
    config: { get: vi.fn(), set: vi.fn() },
    linear: {
      fetch: vi.fn(),
      fetchIssueDetail: vi.fn(),
      refresh: vi.fn(),
      fetchTeamTriage: vi.fn(),
      getViewerId: vi.fn(),
    },
    spec: {
      get: vi.fn(),
      generate: vi.fn(),
      write: vi.fn(),
      launchReview: vi.fn(),
      onChunk: vi.fn(),
      onDone: vi.fn(),
      onError: vi.fn(),
      onPhase: vi.fn(() => vi.fn()),
    },
    triage: {
      get: vi.fn(),
      generate: vi.fn(),
      write: vi.fn(),
      onChunk: vi.fn(),
      onDone: vi.fn(),
      onError: vi.fn(),
      onPhase: vi.fn(() => vi.fn()),
    },
    comments: {
      fetch,
      generateSummary,
    },
  };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('CommentsTab', () => {
  it('requests comment summary by issue id only', async () => {
    const comments = [
      {
        id: 'comment-1',
        body: 'Summarize me.',
        createdAt: '2026-05-20T12:00:00.000Z',
        authorName: 'Alice',
        isBot: false,
      },
    ];
    const fetch = vi.fn().mockResolvedValue({
      issueId: 'FUL-7',
      comments,
      commentCount: 1,
    });
    const generateSummary = vi.fn().mockResolvedValue({
      issueId: 'FUL-7',
      comments,
      commentCount: 1,
      summary: '## Summary\nSummarize me.',
    });
    setCommentsApi({ fetch, generateSummary });

    render(<CommentsTab issue={issueA} />);

    await screen.findByText('Summarize me.');
    fireEvent.click(screen.getByRole('button', { name: 'Generate Comment Summary' }));

    await waitFor(() => {
      expect(generateSummary).toHaveBeenCalledWith('FUL-7');
    });
  });

  it('fetches raw comments on mount, shows a spinner while checking, and disables generation when none exist', async () => {
    const fetchDone = createDeferred<{
      issueId: string;
      comments: [];
      commentCount: number;
      skippedReason: 'no-comments';
    }>();
    const fetch = vi.fn(() => fetchDone.promise);
    const generateSummary = vi.fn();
    setCommentsApi({ fetch, generateSummary });

    const { container } = render(<CommentsTab issue={issueA} />);

    const button = screen.getByRole('button', { name: 'Checking comments...' });
    expect(button.hasAttribute('disabled')).toBe(true);
    expect(container.querySelector('.stream-spinner')).toBeTruthy();
    expect(fetch).toHaveBeenCalledWith('FUL-7');

    fetchDone.resolve({
      issueId: 'FUL-7',
      comments: [],
      commentCount: 0,
      skippedReason: 'no-comments',
    });

    await screen.findByText('No human comments found for this issue.');
    expect(screen.getByRole('button', { name: 'No comments to summarize' }).hasAttribute('disabled')).toBe(
      true,
    );
    expect(screen.getByText('0 comment(s)')).toBeTruthy();
    expect(generateSummary).not.toHaveBeenCalled();
  });

  it('shows raw comments from the initial fetch before summary generation', async () => {
    const fetch = vi.fn().mockResolvedValue({
      issueId: 'FUL-7',
      comments: [
        {
          id: 'comment-1',
          body: 'Visible before summary.',
          createdAt: '2026-05-20T12:00:00.000Z',
          authorName: 'Alice',
          isBot: false,
        },
      ],
      commentCount: 1,
    });
    setCommentsApi({ fetch });

    render(<CommentsTab issue={issueA} />);

    expect(await screen.findByText('Visible before summary.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Generate Comment Summary' }).hasAttribute('disabled')).toBe(
      false,
    );
    expect(screen.getByText('1 comment(s)')).toBeTruthy();
    expect(screen.getByText('No comment summary generated yet.')).toBeTruthy();
  });

  it('clears prior summary and raw comments when switching issues', async () => {
    const firstComments = [
      {
        id: 'comment-1',
        body: 'Only belongs to the first issue.',
        createdAt: '2026-05-20T12:00:00.000Z',
        authorName: 'Alice',
        isBot: false,
      },
    ];
    const fetch = vi
      .fn()
      .mockResolvedValueOnce({
        issueId: 'FUL-7',
        comments: firstComments,
        commentCount: 1,
      })
      .mockResolvedValueOnce({
        issueId: 'FUL-8',
        comments: [],
        commentCount: 0,
        skippedReason: 'no-comments',
      });
    const generateSummary = vi.fn().mockResolvedValue({
      issueId: 'FUL-7',
      comments: firstComments,
      commentCount: 1,
      summary: '## First summary\nOnly first issue.',
    });
    setCommentsApi({ fetch, generateSummary });

    const { rerender } = render(<CommentsTab issue={issueA} />);
    await screen.findByText('Only belongs to the first issue.');
    fireEvent.click(screen.getByRole('button', { name: 'Generate Comment Summary' }));

    await screen.findByText('First summary');
    expect(screen.getByText('Only belongs to the first issue.')).toBeTruthy();

    rerender(<CommentsTab issue={issueB} />);

    expect(screen.queryByText('First summary')).toBeNull();
    expect(screen.queryByText('Only belongs to the first issue.')).toBeNull();
    expect(await screen.findByText('No human comments found for this issue.')).toBeTruthy();
    expect(fetch).toHaveBeenLastCalledWith('FUL-8');
  });

  it('ignores a stale summary result after switching issues', async () => {
    const firstComments = [
      {
        id: 'comment-1',
        body: 'Belongs only to issue A.',
        createdAt: '2026-05-20T12:00:00.000Z',
        authorName: 'Alice',
        isBot: false,
      },
    ];
    const summaryDone = createDeferred<{
      issueId: string;
      comments: typeof firstComments;
      commentCount: number;
      summary: string;
    }>();
    const fetch = vi
      .fn()
      .mockResolvedValueOnce({
        issueId: 'FUL-7',
        comments: firstComments,
        commentCount: 1,
      })
      .mockResolvedValueOnce({
        issueId: 'FUL-8',
        comments: [],
        commentCount: 0,
        skippedReason: 'no-comments',
      });
    const generateSummary = vi.fn(() => summaryDone.promise);
    setCommentsApi({ fetch, generateSummary });

    const { rerender } = render(<CommentsTab issue={issueA} />);
    await screen.findByText('Belongs only to issue A.');
    fireEvent.click(screen.getByRole('button', { name: 'Generate Comment Summary' }));
    expect(generateSummary).toHaveBeenCalledWith('FUL-7');

    rerender(<CommentsTab issue={issueB} />);
    expect(await screen.findByText('No human comments found for this issue.')).toBeTruthy();

    summaryDone.resolve({
      issueId: 'FUL-7',
      comments: firstComments,
      commentCount: 1,
      summary: '## Stale summary\nThis is issue A only.',
    });

    await waitFor(() => {
      expect(screen.queryByText('Stale summary')).toBeNull();
      expect(screen.queryByText('This is issue A only.')).toBeNull();
      expect(screen.queryByText('Belongs only to issue A.')).toBeNull();
    });
    expect(screen.getByText('No human comments found for this issue.')).toBeTruthy();
  });
});
