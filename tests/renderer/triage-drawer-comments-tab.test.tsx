import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

import type { Issue } from '../../src/shared/types';
import { TriageDrawer } from '../../src/renderer/components/triage-drawer';

vi.mock('../../src/renderer/components/detail-tab', () => ({
  DetailTab: () => <div data-testid="detail-body">detail body</div>,
}));

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

const issue: Issue = {
  id: 'FUL-77',
  uuid: 'uuid-test-fixture',
  title: 'Investigate login regression',
  description: 'reported by support team',
  status: 'triage',
  priority: 'high',
  labels: ['backend'],
  url: 'https://linear.app/ful/issue/FUL-77',
  updatedAt: '2026-05-14T00:00:00.000Z',
  isBug: false,
  assigneeId: 'user-1',
};

function setForgeCommentsApi(fetch: ReturnType<typeof vi.fn>) {
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
      generateSummary: vi.fn(),
    },
  };
}

function renderCommentsTab() {
  render(
    <TriageDrawer
      issue={issue}
      tab="comments"
      canGenerate={true}
      isStreaming={false}
      streaming=""
      brief={null}
      errorMessage={null}
      onGenerate={vi.fn()}
      onClose={vi.fn()}
    />,
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('TriageDrawer comments tab', () => {
  it('fetches comments when opened, shows the loading spinner, then renders arriving comments', async () => {
    const fetchDone = createDeferred<{
      issueId: string;
      comments: Array<{
        id: string;
        body: string;
        createdAt: string;
        authorName: string;
        isBot: boolean;
      }>;
      commentCount: number;
    }>();
    const fetch = vi.fn(() => fetchDone.promise);
    setForgeCommentsApi(fetch);

    const { container } = render(
      <TriageDrawer
        issue={issue}
        tab="comments"
        canGenerate={true}
        isStreaming={false}
        streaming=""
        brief={null}
        errorMessage={null}
        onGenerate={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(fetch).toHaveBeenCalledWith('FUL-77');
    expect(screen.getByRole('button', { name: 'Checking comments...' }).hasAttribute('disabled')).toBe(
      true,
    );
    expect(container.querySelector('.stream-spinner')).toBeTruthy();

    fetchDone.resolve({
      issueId: 'FUL-77',
      comments: [
        {
          id: 'comment-1',
          body: 'Raw triage comment.',
          createdAt: '2026-05-20T12:00:00.000Z',
          authorName: 'Alice',
          isBot: false,
        },
      ],
      commentCount: 1,
    });

    expect(await screen.findByText('Raw triage comment.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Generate Comment Summary' }).hasAttribute('disabled')).toBe(
      false,
    );
  });

  it('disables summary generation when the comment fetch returns no comments', async () => {
    const fetch = vi.fn().mockResolvedValue({
      issueId: 'FUL-77',
      comments: [],
      commentCount: 0,
      skippedReason: 'no-comments',
    });
    setForgeCommentsApi(fetch);

    renderCommentsTab();

    expect(await screen.findByText('No human comments found for this issue.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'No comments to summarize' }).hasAttribute('disabled')).toBe(
      true,
    );
    expect(screen.getByText('0 comment(s)')).toBeTruthy();
  });
});
