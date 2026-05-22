import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import type { Issue, Spec } from '../../src/shared/types';

const specTabMock = vi.fn();

vi.mock('../../src/renderer/components/detail-tab', () => ({
  DetailTab: () => <div data-testid="detail-body">detail body</div>,
}));

vi.mock('../../src/renderer/components/spec-tab', () => ({
  SpecTab: (props: unknown) => {
    specTabMock(props);
    return <div data-testid="spec-body">spec body</div>;
  },
}));

import { SpecDrawer } from '../../src/renderer/components/spec-drawer';

const issue: Issue = {
  id: 'FUL-7',
  uuid: 'uuid-test-fixture',
  title: 'Build the drawer',
  description: 'Linear description',
  status: 'todo',
  priority: 'high',
  labels: ['web', 'ux'],
  url: 'https://linear.app/acme/issue/FUL-7',
  updatedAt: '2026-05-13T12:00:00.000Z',
  isBug: false,
  assigneeId: null,
};

const spec: Spec = {
  issueId: 'FUL-7',
  content: '## Saved\nPersisted body',
  generatedAt: '2026-05-13T12:00:00.000Z',
  approved: false,
};

describe('SpecDrawer', () => {
  afterEach(() => {
    specTabMock.mockClear();
    cleanup();
  });

  it('renders the shell but not drawer content when issue is null', () => {
    const { container } = render(
      <SpecDrawer
        issue={null}
        tab="spec"
        setTab={vi.fn()}
        onClose={vi.fn()}
        spec={null}
        streaming=""
        isStreaming={false}
        errorMessage={null}
        claudeModel="claude-sonnet-4-6"
        onClaudeModelChange={vi.fn()}
        onGenerate={vi.fn()}
        onCopy={vi.fn()}
      />,
    );

    expect(container.querySelector('.drawer-scrim')).toBeTruthy();
    expect(container.querySelector('.drawer-scrim-open')).toBeNull();
    expect(container.querySelector('.drawer')).toBeTruthy();
    expect(container.querySelector('.drawer-open')).toBeNull();
    expect(container.querySelector('.drawer-id')).toBeNull();
    expect(container.querySelector('.drawer-body')).toBeNull();
  });

  it('adds open classes and renders the header when issue exists', () => {
    const { container } = render(
      <SpecDrawer
        issue={issue}
        tab="detail"
        setTab={vi.fn()}
        onClose={vi.fn()}
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

    expect(container.querySelector('.drawer-scrim-open')).toBeTruthy();
    expect(container.querySelector('.drawer-open')).toBeTruthy();
    expect(screen.getByText('FUL-7')).toBeTruthy();
    expect(screen.getByText('Build the drawer')).toBeTruthy();
  });

  it('closes on Escape and removes the handler after unmount', () => {
    const onClose = vi.fn();
    const { unmount } = render(
      <SpecDrawer
        issue={issue}
        tab="spec"
        setTab={vi.fn()}
        onClose={onClose}
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

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);

    unmount();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose from the close button', () => {
    const onClose = vi.fn();
    render(
      <SpecDrawer
        issue={issue}
        tab="spec"
        setTab={vi.fn()}
        onClose={onClose}
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

    fireEvent.click(screen.getByRole('button', { name: /Close/i }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('switches tabs by calling setTab and marks the active tab only', () => {
    const setTab = vi.fn();
    const { container } = render(
      <SpecDrawer
        issue={issue}
        tab="spec"
        setTab={setTab}
        onClose={vi.fn()}
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

    fireEvent.click(screen.getByRole('button', { name: 'Detail' }));

    expect(setTab).toHaveBeenCalledWith('detail');
    expect(container.querySelector('.drawer-tab-active')?.textContent).toBe('Spec');
  });

  it('renders the detail tab body or the spec tab body based on tab', () => {
    const { rerender } = render(
      <SpecDrawer
        issue={issue}
        tab="detail"
        setTab={vi.fn()}
        onClose={vi.fn()}
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

    expect(screen.getByTestId('detail-body')).toBeTruthy();
    expect(screen.queryByTestId('spec-body')).toBeNull();

    rerender(
      <SpecDrawer
        issue={issue}
        tab="spec"
        setTab={vi.fn()}
        onClose={vi.fn()}
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

    expect(screen.getByTestId('spec-body')).toBeTruthy();
  });

  it('forwards phase and comment count to the spec tab', () => {
    render(
      <SpecDrawer
        issue={issue}
        tab="spec"
        setTab={vi.fn()}
        onClose={vi.fn()}
        spec={spec}
        streaming=""
        phase="triaging"
        commentCount={2}
        isStreaming={true}
        errorMessage={null}
        claudeModel="claude-sonnet-4-6"
        onClaudeModelChange={vi.fn()}
        onGenerate={vi.fn()}
        onCopy={vi.fn()}
      />,
    );

    expect(specTabMock).toHaveBeenCalledWith(
      expect.objectContaining({
        phase: 'triaging',
        commentCount: 2,
      }),
    );
  });

  it('renders every Linear label badge and the outbound anchor attributes', () => {
    render(
      <SpecDrawer
        issue={issue}
        tab="spec"
        setTab={vi.fn()}
        onClose={vi.fn()}
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

    expect(screen.getAllByText('web')).toHaveLength(1);
    expect(screen.getAllByText('ux')).toHaveLength(1);

    const anchor = screen.getByRole('link', { name: /Linear/i });
    expect(anchor.getAttribute('href')).toBe(issue.url);
    expect(anchor.getAttribute('target')).toBe('_blank');
    expect(anchor.getAttribute('rel')).toContain('noreferrer');
  });
});
