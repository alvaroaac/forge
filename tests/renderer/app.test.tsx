import { act, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Issue, Spec, SpecReviewSummary } from '../../src/shared/types';

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

const renderState: {
  issueListPanelProps: { onOpen: (issue: Issue, which: 'detail' | 'spec') => void } | null;
  specDrawerIssue: Issue | null;
  specDrawerProps: {
    spec: Spec | null;
    streaming: string;
    reviewedContent: string | null;
    reviewSummary: SpecReviewSummary | null;
    reviewStatusMessage: string | null;
    reviewErrorMessage: string | null;
    claudeModel: string;
    onClaudeModelChange: (model: string) => void;
    onGenerate: () => void;
    onLaunchReview: (content: string) => void;
    onWrite: (content: string) => void;
  } | null;
  generate: ReturnType<typeof vi.fn>;
  streamSpec: Spec | null;
} = {
  issueListPanelProps: null,
  specDrawerIssue: null,
  specDrawerProps: null,
  generate: vi.fn(),
  streamSpec: null,
};

vi.mock('../../src/renderer/components/top-bar', () => ({
  TopBar: () => <div data-testid="top-bar" />,
}));

vi.mock('../../src/renderer/components/right-panel', () => ({
  RightPanel: () => <div data-testid="right-panel" />,
}));

vi.mock('../../src/renderer/components/issue-list-panel', () => ({
  IssueListPanel: (props: { onOpen: (issue: Issue, which: 'detail' | 'spec') => void }) => {
    renderState.issueListPanelProps = props;
    return <div data-testid="issue-list-panel" />;
  },
}));

vi.mock('../../src/renderer/components/spec-drawer', () => ({
  SpecDrawer: (props: {
    issue: Issue | null;
    spec: Spec | null;
    streaming: string;
    reviewedContent: string | null;
    reviewSummary: SpecReviewSummary | null;
    reviewStatusMessage: string | null;
    reviewErrorMessage: string | null;
    claudeModel: string;
    onClaudeModelChange: (model: string) => void;
    onGenerate: () => void;
    onLaunchReview: (content: string) => void;
    onWrite: (content: string) => void;
  }) => {
    renderState.specDrawerIssue = props.issue;
    renderState.specDrawerProps = props;
    return <div data-testid="spec-drawer" />;
  },
}));

vi.mock('../../src/renderer/hooks/use-auth-status', () => ({
  useAuthStatus: () => ({ linear: true, claudeCode: true, codex: true, computron: true }),
}));

vi.mock('../../src/renderer/hooks/use-config', () => ({
  useConfig: () => ({ linearTeamKey: 'FUL', claudeModel: 'sonnet' }),
}));

const issues: Issue[] = [
  {
    id: 'FUL-1',
    title: 'First',
    description: '',
    status: 'todo',
    priority: 'high',
    labels: [],
    url: 'https://linear.app/acme/issue/FUL-1',
    updatedAt: '2026-05-13T00:00:00.000Z',
    isBug: false,
    assigneeId: null,
  },
  {
    id: 'FUL-2',
    title: 'Second',
    description: '',
    status: 'todo',
    priority: 'low',
    labels: [],
    url: 'https://linear.app/acme/issue/FUL-2',
    updatedAt: '2026-05-13T00:00:00.000Z',
    isBug: false,
    assigneeId: null,
  },
];

vi.mock('../../src/renderer/hooks/use-issues', () => ({
  useIssues: () => ({ issues, lastSync: 0, refresh: vi.fn() }),
}));

vi.mock('../../src/renderer/hooks/use-spec-stream', () => ({
  useSpecStream: () => ({
    spec: renderState.streamSpec,
    streaming: '',
    isStreaming: false,
    errorMessage: null,
    generate: renderState.generate,
  }),
}));

import { App } from '../../src/renderer/app';

describe('App detail drawer refresh', () => {
  beforeEach(() => {
    renderState.issueListPanelProps = null;
    renderState.specDrawerIssue = null;
    renderState.specDrawerProps = null;
    renderState.generate = vi.fn();
    renderState.streamSpec = null;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches fresh issue detail when opening a drawer issue and replaces drawer issue data', async () => {
    const fetchIssueDetail = vi.fn().mockResolvedValue({
      ...issues[0],
      description: 'Fresh description from detail query',
    });
    window.forge = {
      auth: { check: vi.fn() },
      config: { get: vi.fn(), set: vi.fn() },
      linear: {
        fetch: vi.fn(),
        fetchIssueDetail,
        refresh: vi.fn(),
        fetchTeamTriage: vi.fn(),
        getViewerId: vi.fn(),
      },
      triage: {
        generate: vi.fn(),
        write: vi.fn(),
        onChunk: vi.fn(),
        onDone: vi.fn(),
        onError: vi.fn(),
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
    };

    render(<App />);

    await act(async () => {
      renderState.issueListPanelProps?.onOpen(issues[0], 'detail');
    });

    await waitFor(() => {
      expect(fetchIssueDetail).toHaveBeenCalledWith('FUL-1');
    });

    await waitFor(() => {
      expect(renderState.specDrawerIssue?.description).toBe('Fresh description from detail query');
    });
  });

  it('does not replace drawer issue when an older detail request resolves after selection changes', async () => {
    const firstCall = createDeferred<Issue | null>();
    const fetchIssueDetail = vi
      .fn()
      .mockImplementationOnce(() => firstCall.promise)
      .mockResolvedValueOnce({
        ...issues[1],
        description: 'Second issue detail',
      });
    window.forge = {
      auth: { check: vi.fn() },
      config: { get: vi.fn(), set: vi.fn() },
      linear: {
        fetch: vi.fn(),
        fetchIssueDetail,
        refresh: vi.fn(),
        fetchTeamTriage: vi.fn(),
        getViewerId: vi.fn(),
      },
      triage: {
        generate: vi.fn(),
        write: vi.fn(),
        onChunk: vi.fn(),
        onDone: vi.fn(),
        onError: vi.fn(),
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
    };

    render(<App />);

    await act(async () => {
      renderState.issueListPanelProps?.onOpen(issues[0], 'detail');
    });

    await waitFor(() => {
      expect(fetchIssueDetail).toHaveBeenCalledWith('FUL-1');
    });

    await act(async () => {
      renderState.issueListPanelProps?.onOpen(issues[1], 'detail');
    });

    await waitFor(() => {
      expect(fetchIssueDetail).toHaveBeenNthCalledWith(2, 'FUL-2');
    });

    await waitFor(() => {
      expect(renderState.specDrawerIssue?.id).toBe('FUL-2');
      expect(renderState.specDrawerIssue?.description).toBe('Second issue detail');
    });

    await act(async () => {
      firstCall.resolve({
        ...issues[0],
        description: 'Old first issue detail',
      });
      await firstCall.promise;
    });

    expect(renderState.specDrawerIssue?.id).toBe('FUL-2');
    expect(renderState.specDrawerIssue?.description).toBe('Second issue detail');
  });

  it('persists and uses the selected Claude model for spec generation', async () => {
    const configSet = vi.fn().mockResolvedValue(undefined);
    window.forge = {
      auth: { check: vi.fn() },
      config: { get: vi.fn(), set: configSet },
      linear: {
        fetch: vi.fn(),
        refresh: vi.fn(),
        fetchIssueDetail: vi.fn().mockResolvedValue(null),
        fetchTeamTriage: vi.fn(),
        getViewerId: vi.fn(),
      },
      triage: {
        generate: vi.fn(),
        write: vi.fn(),
        onChunk: vi.fn(),
        onDone: vi.fn(),
        onError: vi.fn(),
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
    };

    render(<App />);

    expect(renderState.specDrawerProps?.claudeModel).toBe('sonnet');

    await act(async () => {
      renderState.specDrawerProps?.onClaudeModelChange('opus');
    });

    expect(configSet).toHaveBeenCalledWith({ claudeModel: 'opus' });
    expect(renderState.specDrawerProps?.claudeModel).toBe('opus');

    await act(async () => {
      renderState.specDrawerProps?.onGenerate();
    });

    expect(configSet).toHaveBeenLastCalledWith({ claudeModel: 'opus' });
    expect(renderState.generate).toHaveBeenCalledWith('opus');
  });

  it('writes the drawer spec content through the explicit write action', async () => {
    const specWrite = vi.fn().mockResolvedValue({ issueId: 'FUL-1', content: '# Spec' });
    window.forge = {
      auth: { check: vi.fn() },
      config: { get: vi.fn(), set: vi.fn() },
      linear: {
        fetch: vi.fn(),
        refresh: vi.fn(),
        fetchIssueDetail: vi.fn().mockResolvedValue(null),
        fetchTeamTriage: vi.fn(),
        getViewerId: vi.fn(),
      },
      triage: {
        generate: vi.fn(),
        write: vi.fn(),
        onChunk: vi.fn(),
        onDone: vi.fn(),
        onError: vi.fn(),
      },
      spec: {
        get: vi.fn(),
        generate: vi.fn(),
        write: specWrite,
        launchReview: vi.fn(),
        onChunk: vi.fn(),
        onDone: vi.fn(),
        onError: vi.fn(),
      },
    };

    render(<App />);

    await act(async () => {
      renderState.issueListPanelProps?.onOpen(issues[0], 'spec');
    });

    await act(async () => {
      renderState.specDrawerProps?.onWrite('# Spec');
    });

    expect(specWrite).toHaveBeenCalledWith('FUL-1', '# Spec');
  });

  it('replaces displayed draft content after a successful review result', async () => {
    const launchReview = vi.fn().mockResolvedValue({
      content: '# Revised spec\n\n## Task Summary\nUpdated',
      summary: {
        verdict: 'approved',
        reviewerSummary: 'Looks good',
        commentCount: 2,
        appliedChanges: ['Refined summary'],
        unresolvedComments: [],
      },
    });
    window.forge = {
      auth: { check: vi.fn() },
      config: { get: vi.fn(), set: vi.fn() },
      linear: {
        fetch: vi.fn(),
        refresh: vi.fn(),
        fetchIssueDetail: vi.fn().mockResolvedValue(null),
        fetchTeamTriage: vi.fn(),
        getViewerId: vi.fn(),
      },
      triage: {
        generate: vi.fn(),
        write: vi.fn(),
        onChunk: vi.fn(),
        onDone: vi.fn(),
        onError: vi.fn(),
      },
      spec: {
        get: vi.fn(),
        generate: vi.fn(),
        write: vi.fn(),
        launchReview,
        onChunk: vi.fn(),
        onDone: vi.fn(),
        onError: vi.fn(),
      },
    };
    renderState.streamSpec = {
      issueId: 'FUL-1',
      content: '# Original spec',
      generatedAt: '2026-05-14T12:00:00.000Z',
      approved: false,
    };

    render(<App />);

    await act(async () => {
      renderState.issueListPanelProps?.onOpen(issues[0], 'spec');
    });

    await act(async () => {
      renderState.specDrawerProps?.onLaunchReview('# Original spec');
    });

    await waitFor(() => {
      expect(renderState.specDrawerProps?.reviewedContent).toBe(
        '# Revised spec\n\n## Task Summary\nUpdated',
      );
      expect(renderState.specDrawerProps?.reviewSummary?.verdict).toBe('approved');
    });
  });

  it('does not apply an older review result after the drawer switches issues', async () => {
    const firstReview = createDeferred<{
      content: string;
      summary: SpecReviewSummary;
    }>();
    const launchReview = vi.fn().mockImplementationOnce(() => firstReview.promise);
    window.forge = {
      auth: { check: vi.fn() },
      config: { get: vi.fn(), set: vi.fn() },
      linear: {
        fetch: vi.fn(),
        refresh: vi.fn(),
        fetchIssueDetail: vi.fn().mockResolvedValue(null),
        fetchTeamTriage: vi.fn(),
        getViewerId: vi.fn(),
      },
      triage: {
        generate: vi.fn(),
        write: vi.fn(),
        onChunk: vi.fn(),
        onDone: vi.fn(),
        onError: vi.fn(),
      },
      spec: {
        get: vi.fn(),
        generate: vi.fn(),
        write: vi.fn(),
        launchReview,
        onChunk: vi.fn(),
        onDone: vi.fn(),
        onError: vi.fn(),
      },
    };
    renderState.streamSpec = {
      issueId: 'FUL-1',
      content: '# Original spec',
      generatedAt: '2026-05-14T12:00:00.000Z',
      approved: false,
    };

    render(<App />);

    await act(async () => {
      renderState.issueListPanelProps?.onOpen(issues[0], 'spec');
    });

    await act(async () => {
      renderState.specDrawerProps?.onLaunchReview('# Original spec');
    });

    await waitFor(() => {
      expect(launchReview).toHaveBeenCalledWith('FUL-1', '# Original spec', 'sonnet');
    });

    await act(async () => {
      renderState.issueListPanelProps?.onOpen(issues[1], 'spec');
    });

    await act(async () => {
      firstReview.resolve({
        content: '# Revised for first issue',
        summary: {
          verdict: 'approved',
          reviewerSummary: 'First issue review',
          commentCount: 1,
          appliedChanges: ['Changed first issue'],
          unresolvedComments: [],
        },
      });
      await firstReview.promise;
    });

    expect(renderState.specDrawerIssue?.id).toBe('FUL-2');
    expect(renderState.specDrawerProps?.reviewedContent).toBeNull();
    expect(renderState.specDrawerProps?.reviewSummary).toBeNull();
  });

  it('keeps previous displayed content when review fails', async () => {
    const launchReview = vi.fn().mockRejectedValue(new Error('Review bridge failed'));
    window.forge = {
      auth: { check: vi.fn() },
      config: { get: vi.fn(), set: vi.fn() },
      linear: {
        fetch: vi.fn(),
        refresh: vi.fn(),
        fetchIssueDetail: vi.fn().mockResolvedValue(null),
        fetchTeamTriage: vi.fn(),
        getViewerId: vi.fn(),
      },
      triage: {
        generate: vi.fn(),
        write: vi.fn(),
        onChunk: vi.fn(),
        onDone: vi.fn(),
        onError: vi.fn(),
      },
      spec: {
        get: vi.fn(),
        generate: vi.fn(),
        write: vi.fn(),
        launchReview,
        onChunk: vi.fn(),
        onDone: vi.fn(),
        onError: vi.fn(),
      },
    };
    renderState.streamSpec = {
      issueId: 'FUL-1',
      content: '# Original spec',
      generatedAt: '2026-05-14T12:00:00.000Z',
      approved: false,
    };

    render(<App />);

    await act(async () => {
      renderState.issueListPanelProps?.onOpen(issues[0], 'spec');
    });

    await act(async () => {
      renderState.specDrawerProps?.onLaunchReview('# Original spec');
    });

    await waitFor(() => {
      expect(renderState.specDrawerProps?.reviewedContent).toBeNull();
      expect(renderState.specDrawerProps?.reviewErrorMessage).toBe('Review bridge failed');
    });
  });

  it('writes only revised spec markdown after a successful review', async () => {
    const launchReview = vi.fn().mockResolvedValue({
      content: '# Revised spec only',
      summary: {
        verdict: 'changes_requested',
        reviewerSummary: 'Please tighten wording',
        commentCount: 1,
        appliedChanges: ['Adjusted copy'],
        unresolvedComments: ['Need final sign-off'],
      },
    });
    const specWrite = vi
      .fn()
      .mockResolvedValue({ issueId: 'FUL-1', content: '# Revised spec only' });
    window.forge = {
      auth: { check: vi.fn() },
      config: { get: vi.fn(), set: vi.fn() },
      linear: {
        fetch: vi.fn(),
        refresh: vi.fn(),
        fetchIssueDetail: vi.fn().mockResolvedValue(null),
        fetchTeamTriage: vi.fn(),
        getViewerId: vi.fn(),
      },
      triage: {
        generate: vi.fn(),
        write: vi.fn(),
        onChunk: vi.fn(),
        onDone: vi.fn(),
        onError: vi.fn(),
      },
      spec: {
        get: vi.fn(),
        generate: vi.fn(),
        write: specWrite,
        launchReview,
        onChunk: vi.fn(),
        onDone: vi.fn(),
        onError: vi.fn(),
      },
    };
    renderState.streamSpec = {
      issueId: 'FUL-1',
      content: '# Original spec',
      generatedAt: '2026-05-14T12:00:00.000Z',
      approved: false,
    };

    render(<App />);

    await act(async () => {
      renderState.issueListPanelProps?.onOpen(issues[0], 'spec');
    });

    await act(async () => {
      renderState.specDrawerProps?.onLaunchReview('# Original spec');
    });

    await waitFor(() => {
      expect(renderState.specDrawerProps?.reviewedContent).toBe('# Revised spec only');
    });

    await act(async () => {
      renderState.specDrawerProps?.onWrite(renderState.specDrawerProps?.reviewedContent ?? '');
    });

    expect(specWrite).toHaveBeenCalledWith('FUL-1', '# Revised spec only');
    expect(specWrite).not.toHaveBeenCalledWith(
      'FUL-1',
      expect.stringContaining('Please tighten wording'),
    );
  });
});
