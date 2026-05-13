import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, within } from '@testing-library/react';

import { IssueCard } from '../../src/renderer/components/issue-card';
import type { Issue } from '../../src/shared/types';

const issue: Issue = {
  id: 'FUL-7',
  title: 'do a thing',
  description: '',
  status: 'todo',
  priority: 'high',
  labels: ['web'],
  url: '',
  updatedAt: '',
  isBug: false,
};

describe('IssueCard', () => {
  it('calls onOpen(issue, "spec") when the main card control is clicked', () => {
    const onOpen = vi.fn();
    const { getByRole } = render(
      <IssueCard issue={issue} onOpen={onOpen} isActive={false} hasSpec={false} />,
    );

    fireEvent.click(getByRole('button', { name: /open ful-7 issue/i }));

    expect(onOpen).toHaveBeenCalledWith(issue, 'spec');
  });

  it('calls onOpen(issue, "spec") when the main card control is keyboard-activated', () => {
    const onOpen = vi.fn();
    const { container } = render(
      <IssueCard issue={issue} onOpen={onOpen} isActive={false} hasSpec={false} />,
    );
    const openButton = within(container).getByRole('button', { name: /open ful-7 issue/i });

    openButton.focus();
    fireEvent.keyDown(openButton, { key: 'Enter', code: 'Enter', charCode: 13 });

    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onOpen).toHaveBeenLastCalledWith(issue, 'spec');
  });

  it('calls onOpen(issue, "detail") when Detail is clicked', () => {
    const onOpen = vi.fn();
    const { container } = render(
      <IssueCard issue={issue} onOpen={onOpen} isActive={false} hasSpec={false} />,
    );
    const { getByRole } = within(container);

    fireEvent.click(getByRole('button', { name: /^detail$/i }));

    expect(onOpen).toHaveBeenCalledWith(issue, 'detail');
  });

  it('does not propagate action clicks to card-level onOpen', () => {
    const onOpen = vi.fn();
    const { container } = render(
      <IssueCard issue={issue} onOpen={onOpen} isActive={false} hasSpec={false} />,
    );
    const { getByRole } = within(container);

    fireEvent.click(getByRole('button', { name: /^detail$/i }));

    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onOpen).toHaveBeenCalledWith(issue, 'detail');
  });

  it('shows "View Spec" when hasSpec', () => {
    const onOpen = vi.fn();
    const { getByRole } = render(
      <IssueCard issue={issue} onOpen={onOpen} isActive={false} hasSpec />,
    );

    fireEvent.click(getByRole('button', { name: /view spec/i }));

    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onOpen).toHaveBeenCalledWith(issue, 'spec');
  });
});
