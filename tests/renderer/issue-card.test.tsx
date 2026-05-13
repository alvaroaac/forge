import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';

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
