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

  it('disables Generate brief when canGenerate is false', () => {
    const writeMock = vi.fn();
    setTriageApi(writeMock);

    render(
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

    const generateButton = screen.getByRole('button', { name: /generate brief/i });

    expect(generateButton.getAttribute('disabled')).toBe('');
    expect(screen.getByText(/computronRepoPath/i)).toBeTruthy();
  });

  it('shows streaming label while generation is active', () => {
    const writeMock = vi.fn();
    setTriageApi(writeMock);

    render(
      <TriageDrawer
        issue={issue}
        canGenerate={true}
        isStreaming={true}
        streaming="## Streaming"
        brief={null}
        errorMessage={null}
        onGenerate={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /generating/i })).toBeTruthy();
    expect(screen.getByText(/Streaming/i)).toBeTruthy();
  });

  it('renders brief and error text when present', () => {
    const brief: TriageBrief = {
      issueId: 'FUL-77',
      content: '# Why this issue matters',
      generatedAt: '2026-05-14T00:00:00.000Z',
    };

    render(
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

    expect(screen.getByText(/# Why this issue matters/)).toBeTruthy();
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
  });

  it('prompts before overwrite and retries write when triage file already exists', async () => {
    const brief: TriageBrief = {
      issueId: 'FUL-77',
      content: '# done',
      generatedAt: '2026-05-14T00:00:00.000Z',
    };

    const writeMock = vi
      .fn()
      .mockResolvedValueOnce({ issueId: 'FUL-77', path: '/tmp/FUL-77/triage-brief.md', written: false, exists: true })
      .mockResolvedValueOnce({ issueId: 'FUL-77', path: '/tmp/FUL-77/triage-brief.md', written: true, exists: true });

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
});
