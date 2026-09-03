import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

import type { Issue, GeneratedBrief } from '../../src/shared/types';
import { BriefDrawer } from '../../src/renderer/components/brief-drawer';

const commentsTabMock = vi.fn();

vi.mock('../../src/renderer/components/detail-tab', () => ({
  DetailTab: () => <div data-testid="detail-body">detail body</div>,
}));

vi.mock('../../src/renderer/components/comments-tab', () => ({
  CommentsTab: (props: unknown) => {
    commentsTabMock(props);
    return <div data-testid="comments-body">comments body</div>;
  },
}));

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

function setBriefApi(writeMock: ReturnType<typeof vi.fn>) {
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
    brief: {
      get: vi.fn(),
      generate: vi.fn(),
      write: writeMock,
      onChunk: vi.fn(),
      onDone: vi.fn(),
      onError: vi.fn(),
      onPhase: vi.fn(() => vi.fn()),
    },
    comments: {
      fetch: vi.fn(),
      generateSummary: vi.fn(),
    },
  };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  commentsTabMock.mockClear();
});

describe('BriefDrawer', () => {
  it('returns null when there is no active issue', () => {
    const { container } = render(
      <BriefDrawer
        issue={null}
        canGenerate={false}
        isStreaming={false}
        streaming=""
        brief={null}
        errorMessage={null}
        onGenerate={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(container.firstChild).toBeNull();
  });

  it('opens the drawer shell and disables Generate Brief when canGenerate is false', () => {
    const writeMock = vi.fn();
    setBriefApi(writeMock);

    const { container } = render(
      <BriefDrawer
        issue={issue}
        tab="brief"
        canGenerate={false}
        isStreaming={false}
        streaming=""
        brief={null}
        errorMessage={null}
        onGenerate={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(container.querySelector('.drawer-scrim-open')).toBeTruthy();
    expect(container.querySelector('.drawer-open')).toBeTruthy();
    const generateButton = screen.getByRole('button', { name: 'Generate Brief' });

    expect(generateButton.getAttribute('disabled')).toBe('');
    expect(generateButton.className).toContain('btn-ghost-accent');
    expect(screen.getByText(/computronRepoPath/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Brief' })).toBeTruthy();
    expect(screen.getByText('No brief yet for FUL-77.')).toBeTruthy();
    expect(screen.getByText('thoughts/tasks/FUL-77/brief.md')).toBeTruthy();
  });

  it('defaults to the Details tab when no tab is provided', () => {
    const writeMock = vi.fn();
    setBriefApi(writeMock);

    render(
      <BriefDrawer
        issue={issue}
        canGenerate={true}
        isStreaming={false}
        streaming=""
        brief={null}
        errorMessage={null}
        onGenerate={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Details' }).className).toContain(
      'drawer-tab-active',
    );
    expect(screen.getByTestId('detail-body')).toBeTruthy();
    expect(screen.queryByText('No brief yet for FUL-77.')).toBeNull();
  });

  it('shows Details, Comments, and Brief tabs and switches by calling setTab', () => {
    const writeMock = vi.fn();
    const setTab = vi.fn();
    setBriefApi(writeMock);

    const { rerender } = render(
      <BriefDrawer
        issue={issue}
        tab="brief"
        setTab={setTab}
        canGenerate={true}
        isStreaming={false}
        streaming=""
        brief={null}
        errorMessage={null}
        onGenerate={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Details' }));
    fireEvent.click(screen.getByRole('button', { name: 'Comments' }));

    expect(setTab).toHaveBeenCalledWith('detail');
    expect(setTab).toHaveBeenCalledWith('comments');
    expect(screen.getByRole('button', { name: 'Brief' }).className).toContain(
      'drawer-tab-active',
    );

    rerender(
      <BriefDrawer
        issue={issue}
        tab="detail"
        setTab={setTab}
        canGenerate={true}
        isStreaming={false}
        streaming=""
        brief={null}
        errorMessage={null}
        onGenerate={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByTestId('detail-body')).toBeTruthy();

    rerender(
      <BriefDrawer
        issue={issue}
        tab="comments"
        setTab={setTab}
        canGenerate={true}
        isStreaming={false}
        streaming=""
        brief={null}
        errorMessage={null}
        onGenerate={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByTestId('comments-body')).toBeTruthy();
    expect(commentsTabMock).toHaveBeenCalledWith(expect.objectContaining({ issue }));
  });

  it('closes when the drawer scrim is clicked', () => {
    const writeMock = vi.fn();
    const onClose = vi.fn();
    setBriefApi(writeMock);

    const { container } = render(
      <BriefDrawer
        issue={issue}
        tab="brief"
        canGenerate={true}
        isStreaming={false}
        streaming=""
        brief={null}
        errorMessage={null}
        onGenerate={vi.fn()}
        onClose={onClose}
      />,
    );

    fireEvent.click(container.querySelector('.drawer-scrim-open')!);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onGenerate from the Generate Brief action', () => {
    const writeMock = vi.fn();
    const onGenerate = vi.fn();
    setBriefApi(writeMock);

    render(
      <BriefDrawer
        issue={issue}
        tab="brief"
        canGenerate={true}
        isStreaming={false}
        streaming=""
        brief={null}
        errorMessage={null}
        onGenerate={onGenerate}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Generate Brief' }));

    expect(onGenerate).toHaveBeenCalledTimes(1);
  });

  it('shows brief generation activity before content arrives', () => {
    const writeMock = vi.fn();
    setBriefApi(writeMock);

    render(
      <BriefDrawer
        issue={issue}
        tab="brief"
        canGenerate={true}
        isStreaming={true}
        streaming=""
        streamStatus={['Starting Claude', 'Reading Computron repo context']}
        brief={null}
        errorMessage={null}
        onGenerate={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.getByText('Generating brief')).toBeTruthy();
    expect(screen.getByText('Reading Computron repo context')).toBeTruthy();
    expect(screen.getByText('Starting Claude')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Generate Brief' }).getAttribute('disabled')).toBe(
      '',
    );
  });

  it('shows triaging comment activity before brief content arrives', () => {
    const writeMock = vi.fn();
    setBriefApi(writeMock);

    render(
      <BriefDrawer
        issue={issue}
        tab="brief"
        canGenerate={true}
        isStreaming={true}
        streaming=""
        phase="triaging"
        commentCount={3}
        brief={null}
        errorMessage={null}
        onGenerate={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText('Triaging 3 comment(s)…')).toBeTruthy();
  });

  it('shows no-comment activity before brief content arrives', () => {
    const writeMock = vi.fn();
    setBriefApi(writeMock);

    render(
      <BriefDrawer
        issue={issue}
        tab="brief"
        canGenerate={true}
        isStreaming={true}
        streaming=""
        phase="triaging"
        commentCount={0}
        brief={null}
        errorMessage={null}
        onGenerate={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText('No comments to triage')).toBeTruthy();
  });

  it('shows an unknown comment count while triaging before brief content arrives', () => {
    const writeMock = vi.fn();
    setBriefApi(writeMock);

    render(
      <BriefDrawer
        issue={issue}
        tab="brief"
        canGenerate={true}
        isStreaming={true}
        streaming=""
        phase="triaging"
        brief={null}
        errorMessage={null}
        onGenerate={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText('Triaging … comment(s)…')).toBeTruthy();
  });

  it('shows generating activity before brief content arrives', () => {
    const writeMock = vi.fn();
    setBriefApi(writeMock);

    render(
      <BriefDrawer
        issue={issue}
        tab="brief"
        canGenerate={true}
        isStreaming={true}
        streaming=""
        phase="generating"
        brief={null}
        errorMessage={null}
        onGenerate={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText('Generating brief…')).toBeTruthy();
  });

  it('hides phase activity after brief content arrives', () => {
    const writeMock = vi.fn();
    setBriefApi(writeMock);

    render(
      <BriefDrawer
        issue={issue}
        tab="brief"
        canGenerate={true}
        isStreaming={true}
        streaming={'## Live brief\n\nStreaming body'}
        phase="triaging"
        commentCount={3}
        brief={null}
        errorMessage={null}
        onGenerate={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.queryByText('Triaging 3 comment(s)…')).toBeNull();
    expect(screen.getByText('Live brief')).toBeTruthy();
  });

  it('shows streaming content instead of a saved brief while regenerating', () => {
    const savedBrief: GeneratedBrief = {
      issueId: 'FUL-77',
      content: '## Saved brief\nOld context.',
      generatedAt: '2026-05-14T00:00:00.000Z',
    };
    const writeMock = vi.fn();
    setBriefApi(writeMock);

    render(
      <BriefDrawer
        issue={issue}
        tab="brief"
        canGenerate={true}
        isStreaming={true}
        streaming={'## New brief\n\nFresh streamed context.'}
        streamStatus={['Starting Claude']}
        brief={savedBrief}
        errorMessage={null}
        onGenerate={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText('New brief')).toBeTruthy();
    expect(screen.getByText('Fresh streamed context.')).toBeTruthy();
    expect(screen.queryByText('Saved brief')).toBeNull();
    expect(screen.queryByText('Old context.')).toBeNull();
  });

  it('writes the displayed streaming brief while regenerating over a saved brief', async () => {
    const savedBrief: GeneratedBrief = {
      issueId: 'FUL-77',
      content: '## Saved brief\nOld context.',
      generatedAt: '2026-05-14T00:00:00.000Z',
    };
    const writeMock = vi.fn().mockResolvedValue({
      issueId: 'FUL-77',
      path: '/tmp/FUL-77/brief.md',
      written: true,
      exists: false,
    });

    setBriefApi(writeMock);

    render(
      <BriefDrawer
        issue={issue}
        tab="brief"
        canGenerate={true}
        isStreaming={true}
        streaming={'## New brief\n\nFresh streamed context.'}
        streamStatus={['Starting Claude']}
        brief={savedBrief}
        errorMessage={null}
        onGenerate={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /write to file/i }));

    await waitFor(() => {
      expect(writeMock).toHaveBeenCalledWith(
        'FUL-77',
        '## New brief\n\nFresh streamed context.',
      );
    });
  });

  it('shows loading activity instead of Generate Brief while checking for a saved brief', () => {
    const writeMock = vi.fn();
    setBriefApi(writeMock);

    render(
      <BriefDrawer
        issue={issue}
        tab="brief"
        canGenerate={true}
        isStreaming={false}
        streaming=""
        isBriefLoading={true}
        brief={null}
        errorMessage={null}
        onGenerate={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.getByText('Loading brief')).toBeTruthy();
    expect(screen.getByText('Checking brief.md')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Generate Brief' })).toBeNull();
  });

  it('renders brief content as markdown instead of raw preformatted text', () => {
    const brief: GeneratedBrief = {
      issueId: 'FUL-77',
      content: '## Why this issue matters\nUse `GeneratedDocument` for briefs.',
      generatedAt: '2026-05-14T00:00:00.000Z',
    };

    const { container } = render(
      <BriefDrawer
        issue={issue}
        tab="brief"
        canGenerate={true}
        isStreaming={false}
        streaming=""
        brief={brief}
        errorMessage="something failed"
        onGenerate={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(container.querySelector('pre')).toBeNull();
    expect(container.querySelectorAll('.md-section')).toHaveLength(1);
    expect(screen.getByText('Why this issue matters')).toBeTruthy();
    expect(container.querySelector('.md-code')?.textContent).toBe('GeneratedDocument');
    expect(screen.getByText('something failed')).toBeTruthy();
  });

  it('renders Write to file button only when brief exists', () => {
    const writeMock = vi.fn();
    setBriefApi(writeMock);

    const { rerender } = render(
      <BriefDrawer
        issue={issue}
        tab="brief"
        canGenerate={true}
        isStreaming={false}
        streaming=""
        brief={null}
        errorMessage={null}
        onGenerate={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: /write to file/i })).toBeNull();

    const brief: GeneratedBrief = {
      issueId: 'FUL-77',
      content: '# done',
      generatedAt: '2026-05-14T00:00:00.000Z',
    };

    rerender(
      <BriefDrawer
        issue={issue}
        tab="brief"
        canGenerate={true}
        isStreaming={false}
        streaming=""
        brief={brief}
        errorMessage={null}
        onGenerate={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /write to file/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /write to file/i }).className).toContain('btn-ghost');
  });

  it('prompts before overwrite and retries write when the brief file already exists', async () => {
    const brief: GeneratedBrief = {
      issueId: 'FUL-77',
      content: '# done',
      generatedAt: '2026-05-14T00:00:00.000Z',
    };

    const writeMock = vi
      .fn()
      .mockResolvedValueOnce({
        issueId: 'FUL-77',
        path: '/tmp/FUL-77/brief.md',
        written: false,
        exists: true,
      })
      .mockResolvedValueOnce({
        issueId: 'FUL-77',
        path: '/tmp/FUL-77/brief.md',
        written: true,
        exists: true,
      });

    setBriefApi(writeMock);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(
      <BriefDrawer
        issue={issue}
        tab="brief"
        canGenerate={true}
        isStreaming={false}
        streaming=""
        brief={brief}
        errorMessage={null}
        onGenerate={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /write to file/i }));

    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalledWith('Overwrite existing brief.md?');
      expect(writeMock).toHaveBeenCalledTimes(2);
      expect(writeMock).toHaveBeenNthCalledWith(1, 'FUL-77', '# done');
      expect(writeMock).toHaveBeenNthCalledWith(2, 'FUL-77', '# done', { overwrite: true });
    });
  });

  it('returns to Write to file when overwrite is cancelled', async () => {
    const brief: GeneratedBrief = {
      issueId: 'FUL-77',
      content: '# done',
      generatedAt: '2026-05-14T00:00:00.000Z',
    };

    const writeMock = vi.fn().mockResolvedValueOnce({
      issueId: 'FUL-77',
      path: '/tmp/FUL-77/brief.md',
      written: false,
      exists: true,
    });

    setBriefApi(writeMock);
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    render(
      <BriefDrawer
        issue={issue}
        tab="brief"
        canGenerate={true}
        isStreaming={false}
        streaming=""
        brief={brief}
        errorMessage={null}
        onGenerate={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /write to file/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Write to file/i })).toBeTruthy();
    });
    expect(screen.queryByRole('button', { name: /Saved to file/i })).toBeNull();
    expect(writeMock).toHaveBeenCalledTimes(1);
  });

  it('shows write progress then disables after saving a brief', async () => {
    const brief: GeneratedBrief = {
      issueId: 'FUL-77',
      content: '# done',
      generatedAt: '2026-05-14T00:00:00.000Z',
    };
    const writeDone = createDeferred<{
      issueId: string;
      path: string;
      written: boolean;
      exists: boolean;
    }>();
    const writeMock = vi.fn(() => writeDone.promise);

    setBriefApi(writeMock);

    render(
      <BriefDrawer
        issue={issue}
        tab="brief"
        canGenerate={true}
        isStreaming={false}
        streaming=""
        brief={brief}
        errorMessage={null}
        onGenerate={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /write to file/i }));

    expect(screen.getByRole('button', { name: /Writing.../i }).hasAttribute('disabled')).toBe(true);

    writeDone.resolve({
      issueId: 'FUL-77',
      path: '/tmp/FUL-77/brief.md',
      written: true,
      exists: false,
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Saved to file/i }).hasAttribute('disabled')).toBe(
        true,
      );
    });
  });

  it('starts with Saved to file when the brief is already persisted', () => {
    const brief: GeneratedBrief = {
      issueId: 'FUL-77',
      content: '# already saved',
      generatedAt: '2026-05-14T00:00:00.000Z',
    };
    const writeMock = vi.fn();

    setBriefApi(writeMock);

    render(
      <BriefDrawer
        issue={issue}
        tab="brief"
        canGenerate={true}
        isStreaming={false}
        streaming=""
        isBriefPersisted={true}
        brief={brief}
        errorMessage={null}
        onGenerate={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /Saved to file/i }).hasAttribute('disabled')).toBe(
      true,
    );
  });
});
