import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

import type { Issue, TriageBrief } from '../../src/shared/types';
import { TriageDrawer } from '../../src/renderer/components/triage-drawer';

const issue: Issue = {
  id: 'FUL-77',
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

function setTriageApi(writeMock: ReturnType<typeof vi.fn>) {
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
    },
    triage: {
      generate: vi.fn(),
      write: writeMock,
      onChunk: vi.fn(),
      onDone: vi.fn(),
      onError: vi.fn(),
    },
  };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('TriageDrawer', () => {
  it('returns null when there is no active issue', () => {
    const { container } = render(
      <TriageDrawer
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
    setTriageApi(writeMock);

    const { container } = render(
      <TriageDrawer
        issue={issue}
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
    expect(screen.getByText('Brief')).toBeTruthy();
    expect(screen.getByText('No brief yet for FUL-77.')).toBeTruthy();
    expect(screen.getByText('thoughts/tasks/FUL-77/triage-brief.md')).toBeTruthy();
  });

  it('closes when the drawer scrim is clicked', () => {
    const writeMock = vi.fn();
    const onClose = vi.fn();
    setTriageApi(writeMock);

    const { container } = render(
      <TriageDrawer
        issue={issue}
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
    setTriageApi(writeMock);

    render(
      <TriageDrawer
        issue={issue}
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
    setTriageApi(writeMock);

    render(
      <TriageDrawer
        issue={issue}
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
    expect(screen.getByRole('button', { name: 'Generate Brief' }).getAttribute('disabled')).toBe('');
  });

  it('renders brief content as markdown instead of raw preformatted text', () => {
    const brief: TriageBrief = {
      issueId: 'FUL-77',
      content: '## Why this issue matters\nUse `GeneratedDocument` for briefs.',
      generatedAt: '2026-05-14T00:00:00.000Z',
    };

    const { container } = render(
      <TriageDrawer
        issue={issue}
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
    setTriageApi(writeMock);

    const { rerender } = render(
      <TriageDrawer
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

    expect(screen.queryByRole('button', { name: /write to file/i })).toBeNull();

    const brief: TriageBrief = {
      issueId: 'FUL-77',
      content: '# done',
      generatedAt: '2026-05-14T00:00:00.000Z',
    };

    rerender(
      <TriageDrawer
        issue={issue}
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

  it('prompts before overwrite and retries write when triage file already exists', async () => {
    const brief: TriageBrief = {
      issueId: 'FUL-77',
      content: '# done',
      generatedAt: '2026-05-14T00:00:00.000Z',
    };

    const writeMock = vi
      .fn()
      .mockResolvedValueOnce({
        issueId: 'FUL-77',
        path: '/tmp/FUL-77/triage-brief.md',
        written: false,
        exists: true,
      })
      .mockResolvedValueOnce({
        issueId: 'FUL-77',
        path: '/tmp/FUL-77/triage-brief.md',
        written: true,
        exists: true,
      });

    setTriageApi(writeMock);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(
      <TriageDrawer
        issue={issue}
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
      expect(confirmSpy).toHaveBeenCalledWith('Overwrite existing triage-brief.md?');
      expect(writeMock).toHaveBeenCalledTimes(2);
      expect(writeMock).toHaveBeenNthCalledWith(1, 'FUL-77', '# done');
      expect(writeMock).toHaveBeenNthCalledWith(2, 'FUL-77', '# done', { overwrite: true });
    });
  });

  it('shows write progress then disables after saving a brief', async () => {
    const brief: TriageBrief = {
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

    setTriageApi(writeMock);

    render(
      <TriageDrawer
        issue={issue}
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
      path: '/tmp/FUL-77/triage-brief.md',
      written: true,
      exists: false,
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Saved to file/i }).hasAttribute('disabled')).toBe(true);
    });
  });
});
