import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

import { GeneratedDocument } from '../../src/renderer/components/generated-document';

describe('GeneratedDocument', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the empty state when no content is available', () => {
    render(
      <GeneratedDocument
        artifactPath="thoughts/tasks/FUL-7/initial-spec.md"
        content=""
        isStreaming={false}
        emptyTitle="No document yet."
        emptyDescription="Generate one from the issue context."
        activityTitle="Generating document"
        activityStatusFallback="Starting generator"
      />,
    );

    expect(screen.getByText('No document yet.')).toBeTruthy();
    expect(screen.getByText('Generate one from the issue context.')).toBeTruthy();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('renders activity before content arrives', () => {
    const { container } = render(
      <GeneratedDocument
        artifactPath="thoughts/tasks/FUL-7/triage-brief.md"
        content=""
        isStreaming={true}
        streamStatus={['Starting Claude', 'Reading repository context']}
        emptyTitle="No brief yet."
        activityTitle="Generating brief"
        activityStatusFallback="Starting brief"
      />,
    );

    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.getByText('Generating brief')).toBeTruthy();
    expect(screen.getByText('Reading repository context')).toBeTruthy();
    expect(screen.getByText('Starting Claude')).toBeTruthy();
    expect(container.querySelector('.stream-spinner')).toBeTruthy();
  });

  it('renders markdown sections through MarkdownSection', () => {
    const { container } = render(
      <GeneratedDocument
        artifactPath="thoughts/tasks/FUL-7/initial-spec.md"
        content={'## Summary\nShip `GeneratedDocument`.\n\n## Verification\nRun tests.'}
        isStreaming={false}
        emptyTitle="No document yet."
        activityTitle="Generating document"
        activityStatusFallback="Starting generator"
      />,
    );

    expect(container.querySelectorAll('.md-section')).toHaveLength(2);
    expect(screen.getByText('Summary')).toBeTruthy();
    expect(screen.getByText('Verification')).toBeTruthy();
    expect(container.querySelector('.md-code')?.textContent).toBe('GeneratedDocument');
    expect(container.querySelector('.stream-spinner')).toBeNull();
  });

  it('renders a spinner directly after streamed markdown content', () => {
    const { container } = render(
      <GeneratedDocument
        artifactPath="thoughts/tasks/FUL-7/initial-spec.md"
        content={'## Partial\nStreaming words.'}
        isStreaming={true}
        emptyTitle="No document yet."
        activityTitle="Generating document"
        activityStatusFallback="Starting generator"
      />,
    );

    expect(screen.getByText('Partial')).toBeTruthy();
    expect(container.querySelector('.spec-scroll .stream-spinner-row')).toBeTruthy();
    expect(container.querySelector('.spec-scroll .stream-spinner')).toBeTruthy();
  });

  it('renders populated and empty action slots', () => {
    const { rerender } = render(
      <GeneratedDocument
        artifactPath="thoughts/tasks/FUL-7/initial-spec.md"
        content="## Summary\nReady."
        isStreaming={false}
        emptyTitle="No document yet."
        activityTitle="Generating document"
        activityStatusFallback="Starting generator"
        actions={<button type="button">Copy</button>}
        emptyActions={<button type="button">Generate</button>}
      />,
    );

    expect(screen.getByRole('button', { name: 'Copy' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Generate' })).toBeNull();

    rerender(
      <GeneratedDocument
        artifactPath="thoughts/tasks/FUL-7/initial-spec.md"
        content=""
        isStreaming={false}
        emptyTitle="No document yet."
        activityTitle="Generating document"
        activityStatusFallback="Starting generator"
        actions={<button type="button">Copy</button>}
        emptyActions={<button type="button">Generate</button>}
      />,
    );

    expect(screen.getByRole('button', { name: 'Generate' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Copy' })).toBeNull();
  });

  it('renders populated actions while activity is visible', () => {
    render(
      <GeneratedDocument
        artifactPath="thoughts/tasks/FUL-7/initial-spec.md"
        content=""
        isStreaming={true}
        emptyTitle="No document yet."
        activityTitle="Generating document"
        activityStatusFallback="Starting generator"
        actions={<button type="button">Copy</button>}
      />,
    );

    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Copy' })).toBeTruthy();
  });

  it('renders status and error messages', () => {
    render(
      <GeneratedDocument
        artifactPath="thoughts/tasks/FUL-7/initial-spec.md"
        content="## Partial\nDraft before failure."
        isStreaming={false}
        errorMessage="Claude CLI exited with code 1"
        statusMessage="Review in progress..."
        emptyTitle="No document yet."
        activityTitle="Generating document"
        activityStatusFallback="Starting generator"
      />,
    );

    expect(screen.getByText('Review in progress...')).toBeTruthy();
    expect(screen.getByText('Claude CLI exited with code 1')).toBeTruthy();
    expect(screen.getByText(/failed/i)).toBeTruthy();
  });
});
