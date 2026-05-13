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
  it('calls onOpen(issue, "spec") on card click', () => {
    const onOpen = vi.fn();
    const { getByText } = render(
      <IssueCard issue={issue} onOpen={onOpen} isActive={false} hasSpec={false} />,
    );

    fireEvent.click(getByText('do a thing'));

    expect(onOpen).toHaveBeenCalledWith(issue, 'spec');
  });

  it('calls onOpen(issue, "detail") when Detail is clicked', () => {
    const onOpen = vi.fn();
    const { container } = render(
      <IssueCard issue={issue} onOpen={onOpen} isActive={false} hasSpec={false} />,
    );
    const { getByRole } = within(container);

    fireEvent.click(getByRole('button', { name: 'Detail' }));

    expect(onOpen).toHaveBeenCalledWith(issue, 'detail');
  });

  it('does not propagate action clicks to card-level onOpen', () => {
    const onOpen = vi.fn();
    const { container } = render(
      <IssueCard issue={issue} onOpen={onOpen} isActive={false} hasSpec={false} />,
    );
    const { getByRole } = within(container);

    fireEvent.click(getByRole('button', { name: 'Detail' }));

    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onOpen).toHaveBeenCalledWith(issue, 'detail');
  });

  it('shows "View Spec" when hasSpec', () => {
    const onOpen = vi.fn();
    const { getByText } = render(
      <IssueCard issue={issue} onOpen={onOpen} isActive={false} hasSpec />,
    );

    fireEvent.click(getByText('View Spec'));

    expect(onOpen).toHaveBeenCalledWith(issue, 'spec');
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
