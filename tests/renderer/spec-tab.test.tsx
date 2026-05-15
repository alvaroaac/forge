import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import { SpecTab } from '../../src/renderer/components/spec-tab';
import type { Issue, Spec, SpecReviewSummary } from '../../src/shared/types';

const issue: Issue = {
  id: 'FUL-7',
  title: 'Build the spec tab',
  description: '',
  status: 'todo',
  priority: 'high',
  labels: [],
  url: '',
  updatedAt: '',
  isBug: false,
  assigneeId: null,
};

const spec: Spec = {
  issueId: 'FUL-7',
  content: `## Saved
Persisted body`,
  generatedAt: '2026-05-13T12:00:00.000Z',
  approved: false,
};

const reviewSummary: SpecReviewSummary = {
  verdict: 'changes_requested',
  reviewerSummary: 'Clarify rollout assumptions and clean acceptance criteria.',
  commentCount: 3,
  appliedChanges: ['Adjusted scope wording', 'Updated acceptance checks'],
  unresolvedComments: ['Need final owner call on migration timing'],
};

describe('SpecTab', () => {
  afterEach(() => {
    cleanup();
  });

  it('shows the empty state and triggers generation when nothing is available yet', () => {
    const onGenerate = vi.fn();

    render(
      <SpecTab
        issue={issue}
        spec={null}
        streaming=""
        isStreaming={false}
        errorMessage={null}
        claudeModel="claude-sonnet-4-6"
        onClaudeModelChange={vi.fn()}
        onGenerate={onGenerate}
        onCopy={vi.fn()}
      />,
    );

    expect(screen.getByText(/No spec yet for/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Generate Spec/i }));

    expect(onGenerate).toHaveBeenCalledTimes(1);
  });

  it('renders the spec file path with the actual issue id', () => {
    render(
      <SpecTab
        issue={issue}
        spec={spec}
        streaming=""
        isStreaming={false}
        errorMessage={null}
        claudeModel="claude-sonnet-4-6"
        onClaudeModelChange={vi.fn()}
        onGenerate={vi.fn()}
        onCopy={vi.fn()}
      />,
    );

    expect(screen.getByText('thoughts/tasks/FUL-7/initial-spec.md')).toBeTruthy();
  });

  it('prefers streaming content over the saved spec content', () => {
    render(
      <SpecTab
        issue={issue}
        spec={spec}
        streaming={`## Live
Streaming body`}
        isStreaming={true}
        errorMessage={null}
        claudeModel="claude-sonnet-4-6"
        onClaudeModelChange={vi.fn()}
        onGenerate={vi.fn()}
        onCopy={vi.fn()}
      />,
    );

    expect(screen.getByText('Live')).toBeTruthy();
    expect(screen.getByText('Streaming body')).toBeTruthy();
    expect(screen.queryByText('Saved')).toBeNull();
    expect(screen.queryByText('Persisted body')).toBeNull();
  });

  it('shows the streaming marker while content is streaming', () => {
    render(
      <SpecTab
        issue={issue}
        spec={spec}
        streaming={`## Live
Streaming body`}
        isStreaming={true}
        errorMessage={null}
        claudeModel="claude-sonnet-4-6"
        onClaudeModelChange={vi.fn()}
        onGenerate={vi.fn()}
        onCopy={vi.fn()}
      />,
    );

    expect(screen.getByText(/streaming…/i)).toBeTruthy();
  });

  it('shows generation activity before markdown content arrives', () => {
    render(
      <SpecTab
        issue={issue}
        spec={null}
        streaming=""
        streamStatus={['Starting Claude', 'Claude initialized the repo session']}
        isStreaming={true}
        errorMessage={null}
        claudeModel="claude-sonnet-4-6"
        onClaudeModelChange={vi.fn()}
        onGenerate={vi.fn()}
        onCopy={vi.fn()}
      />,
    );

    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.getByText('Generating spec')).toBeTruthy();
    expect(screen.getByText('Claude initialized the repo session')).toBeTruthy();
    expect(screen.getByText('Starting Claude')).toBeTruthy();
  });

  it('copies the live streaming content while streaming', () => {
    const onCopy = vi.fn();

    render(
      <SpecTab
        issue={issue}
        spec={spec}
        streaming={`## Live
Streaming body`}
        isStreaming={true}
        errorMessage={null}
        claudeModel="claude-sonnet-4-6"
        onClaudeModelChange={vi.fn()}
        onGenerate={vi.fn()}
        onCopy={onCopy}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Copy/i }));

    expect(onCopy).toHaveBeenCalledWith(`## Live
Streaming body`);
  });

  it('copies the saved spec content when not streaming', () => {
    const onCopy = vi.fn();

    render(
      <SpecTab
        issue={issue}
        spec={spec}
        streaming=""
        isStreaming={false}
        errorMessage={null}
        claudeModel="claude-sonnet-4-6"
        onClaudeModelChange={vi.fn()}
        onGenerate={vi.fn()}
        onCopy={onCopy}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Copy/i }));

    expect(onCopy).toHaveBeenCalledWith(`## Saved
Persisted body`);
  });

  it('exposes generated spec actions from the primary spec view', () => {
    const onLaunchReview = vi.fn();
    const onWrite = vi.fn();

    render(
      <SpecTab
        issue={issue}
        spec={spec}
        streaming=""
        isStreaming={false}
        errorMessage={null}
        claudeModel="claude-sonnet-4-6"
        onClaudeModelChange={vi.fn()}
        onGenerate={vi.fn()}
        onLaunchReview={onLaunchReview}
        onWrite={onWrite}
        onCopy={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Launch Review/i }));
    fireEvent.click(screen.getByRole('button', { name: /Write to file/i }));

    expect(onLaunchReview).toHaveBeenCalledWith(`## Saved
Persisted body`);
    expect(onWrite).toHaveBeenCalledWith(`## Saved
Persisted body`);
  });

  it('calls onLaunchReview with the displayed cleaned content', () => {
    const onLaunchReview = vi.fn();
    const wrappedSpec: Spec = {
      ...spec,
      content: 'Permission needed\n\n```markdown\n# Spec: FUL-7\n\n## Task Summary\nBody\n```',
    };

    render(
      <SpecTab
        issue={issue}
        spec={wrappedSpec}
        streaming=""
        isStreaming={false}
        errorMessage={null}
        claudeModel="claude-sonnet-4-6"
        onClaudeModelChange={vi.fn()}
        onGenerate={vi.fn()}
        onLaunchReview={onLaunchReview}
        onCopy={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Launch Review/i }));

    expect(onLaunchReview).toHaveBeenCalledWith('# Spec: FUL-7\n\n## Task Summary\nBody');
  });

  it('disables launch review while review is pending', () => {
    render(
      <SpecTab
        issue={issue}
        spec={spec}
        streaming=""
        isStreaming={false}
        errorMessage={null}
        claudeModel="claude-sonnet-4-6"
        onClaudeModelChange={vi.fn()}
        onGenerate={vi.fn()}
        isReviewPending={true}
        onCopy={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /Launch Review/i }).hasAttribute('disabled')).toBe(
      true,
    );
  });

  it('renders pending status text while review is running', () => {
    render(
      <SpecTab
        issue={issue}
        spec={spec}
        streaming=""
        isStreaming={false}
        errorMessage={null}
        claudeModel="claude-sonnet-4-6"
        onClaudeModelChange={vi.fn()}
        onGenerate={vi.fn()}
        isReviewPending={true}
        onCopy={vi.fn()}
      />,
    );

    expect(screen.getByText('Review in progress...')).toBeTruthy();
  });

  it('keeps review changes collapsed by default and expands on click', () => {
    render(
      <SpecTab
        issue={issue}
        spec={spec}
        streaming=""
        isStreaming={false}
        errorMessage={null}
        claudeModel="claude-sonnet-4-6"
        onClaudeModelChange={vi.fn()}
        onGenerate={vi.fn()}
        reviewSummary={reviewSummary}
        onCopy={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /Review changes/i })).toBeTruthy();
    expect(
      screen.getByRole('button', { name: /Review changes/i }).getAttribute('aria-expanded'),
    ).toBe('false');
    expect(screen.queryByText(reviewSummary.reviewerSummary)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Review changes/i }));

    expect(
      screen.getByRole('button', { name: /Review changes/i }).getAttribute('aria-expanded'),
    ).toBe('true');
    expect(screen.getByText(reviewSummary.reviewerSummary)).toBeTruthy();
  });

  it('renders review summary fields when expanded', () => {
    render(
      <SpecTab
        issue={issue}
        spec={spec}
        streaming=""
        isStreaming={false}
        errorMessage={null}
        claudeModel="claude-sonnet-4-6"
        onClaudeModelChange={vi.fn()}
        onGenerate={vi.fn()}
        reviewSummary={reviewSummary}
        onCopy={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Review changes/i }));

    expect(screen.getByText(reviewSummary.verdict)).toBeTruthy();
    expect(screen.getByText(reviewSummary.reviewerSummary)).toBeTruthy();
    expect(screen.getByText(String(reviewSummary.commentCount))).toBeTruthy();
    expect(screen.getByText('Adjusted scope wording')).toBeTruthy();
    expect(screen.getByText('Updated acceptance checks')).toBeTruthy();
    expect(screen.getByText('Need final owner call on migration timing')).toBeTruthy();
  });

  it('cleans generated wrapper text before rendering actions', () => {
    const onWrite = vi.fn();
    const wrappedSpec: Spec = {
      ...spec,
      content: 'Permission needed\n\n```markdown\n# Spec: FUL-7\n\n## Task Summary\nBody\n```',
    };

    render(
      <SpecTab
        issue={issue}
        spec={wrappedSpec}
        streaming=""
        isStreaming={false}
        errorMessage={null}
        claudeModel="claude-sonnet-4-6"
        onClaudeModelChange={vi.fn()}
        onGenerate={vi.fn()}
        onWrite={onWrite}
        onCopy={vi.fn()}
      />,
    );

    expect(screen.queryByText(/Permission needed/i)).toBeNull();
    expect(screen.getByText('Spec: FUL-7')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Write to file/i }));

    expect(onWrite).toHaveBeenCalledWith('# Spec: FUL-7\n\n## Task Summary\nBody');
  });

  it('shows the generation error while the spec is still empty', () => {
    render(
      <SpecTab
        issue={issue}
        spec={null}
        streaming=""
        isStreaming={false}
        errorMessage="Claude CLI exited with code 1"
        claudeModel="claude-sonnet-4-6"
        onClaudeModelChange={vi.fn()}
        onGenerate={vi.fn()}
        onCopy={vi.fn()}
      />,
    );

    expect(screen.getByText('Claude CLI exited with code 1')).toBeTruthy();
  });

  it('shows the generation error alongside partial streamed content', () => {
    render(
      <SpecTab
        issue={issue}
        spec={null}
        streaming={`## Partial
Draft before failure`}
        isStreaming={false}
        errorMessage="Claude CLI exited with code 1"
        claudeModel="claude-sonnet-4-6"
        onClaudeModelChange={vi.fn()}
        onGenerate={vi.fn()}
        onCopy={vi.fn()}
      />,
    );

    expect(screen.getByText('Partial')).toBeTruthy();
    expect(screen.getByText('Draft before failure')).toBeTruthy();
    expect(screen.getByText(/failed/i)).toBeTruthy();
    expect(screen.getByText('Claude CLI exited with code 1')).toBeTruthy();
  });

  it('lets the user choose the spec generation model', () => {
    const onClaudeModelChange = vi.fn();

    render(
      <SpecTab
        issue={issue}
        spec={null}
        streaming=""
        isStreaming={false}
        errorMessage={null}
        claudeModel="sonnet"
        onClaudeModelChange={onClaudeModelChange}
        onGenerate={vi.fn()}
        onCopy={vi.fn()}
      />,
    );

    const select = screen.getByLabelText('Spec generation model') as HTMLSelectElement;
    expect(select.value).toBe('sonnet');

    fireEvent.change(select, { target: { value: 'opus' } });

    expect(onClaudeModelChange).toHaveBeenCalledWith('opus');
  });
});
