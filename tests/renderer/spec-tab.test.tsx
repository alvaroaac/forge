import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import { SpecTab } from '../../src/renderer/components/spec-tab';
import type { Issue, Spec } from '../../src/shared/types';

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
};

const spec: Spec = {
  issueId: 'FUL-7',
  content: `## Saved
Persisted body`,
  generatedAt: '2026-05-13T12:00:00.000Z',
  approved: false,
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
