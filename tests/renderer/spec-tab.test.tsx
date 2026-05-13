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
        onGenerate={vi.fn()}
        onCopy={onCopy}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Copy/i }));

    expect(onCopy).toHaveBeenCalledWith(`## Saved
Persisted body`);
  });
});
