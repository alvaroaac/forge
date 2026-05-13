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

    fireEvent.click(getByRole('button', { name: /open ful-7 do a thing/i }));

    expect(onOpen).toHaveBeenCalledWith(issue, 'spec');
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

  it('renders only the first label from issue.labels', () => {
    const issueWithManyLabels: Issue = {
      ...issue,
      labels: ['web', 'ui', 'api'],
    };
    const onOpen = vi.fn();
    const { container } = render(
      <IssueCard issue={issueWithManyLabels} onOpen={onOpen} isActive={false} hasSpec />,
    );
    const { getByText, queryByText } = within(container);

    expect(getByText('web')).toBeTruthy();
    expect(queryByText('ui')).toBeNull();
    expect(queryByText('api')).toBeNull();
  });

  it('does not retrigger the main open action when sibling Spec/Detail actions fire', () => {
    const onOpen = vi.fn();
    const { container } = render(
      <IssueCard issue={issue} onOpen={onOpen} isActive={false} hasSpec={false} />,
    );
    const { getByRole } = within(container);

    fireEvent.click(getByRole('button', { name: /^spec$/i }));

    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onOpen).toHaveBeenCalledWith(issue, 'spec');
  });

  it('shows "View Spec" when hasSpec', () => {
    const onOpen = vi.fn();
    const { container } = render(
      <IssueCard issue={issue} onOpen={onOpen} isActive={false} hasSpec />,
    );
    const { getByRole } = within(container);

    fireEvent.click(getByRole('button', { name: /view spec/i }));

    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onOpen).toHaveBeenCalledWith(issue, 'spec');
  });
});
