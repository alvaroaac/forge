import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';

import { IssueGroup } from '../../src/renderer/components/issue-group';
import type { Issue } from '../../src/shared/types';

const issues: Issue[] = [
  {
    id: 'FUL-1',
    title: 'first issue',
    description: '',
    status: 'todo',
    priority: 'urgent',
    labels: ['frontend'],
    url: '',
    updatedAt: '',
    isBug: false,
  },
  {
    id: 'FUL-2',
    title: 'second issue',
    description: '',
    status: 'todo',
    priority: 'high',
    labels: ['backend'],
    url: '',
    updatedAt: '',
    isBug: false,
  },
  {
    id: 'FUL-3',
    title: 'third issue',
    description: '',
    status: 'todo',
    priority: 'medium',
    labels: ['infra'],
    url: '',
    updatedAt: '',
    isBug: true,
  },
  {
    id: 'FUL-4',
    title: 'fourth issue',
    description: '',
    status: 'todo',
    priority: 'low',
    labels: ['chore'],
    url: '',
    updatedAt: '',
    isBug: false,
  },
];

describe('IssueGroup', () => {
  it('renders header with name and count', () => {
    const hasSpecFor = vi.fn().mockReturnValue(false);

    const { getByText } = render(
      <IssueGroup
        name="Bugs"
        items={issues}
        onOpen={vi.fn()}
        activeId={null}
        hasSpecFor={hasSpecFor}
      />,
    );

    expect(getByText('Bugs')).toBeTruthy();
    expect(getByText('4')).toBeTruthy();
  });

  it('renders one IssueCard per issue', () => {
    const hasSpecFor = vi.fn().mockReturnValue(false);

    const { container } = render(
      <IssueGroup
        name="Feature"
        items={issues}
        onOpen={vi.fn()}
        activeId={null}
        hasSpecFor={hasSpecFor}
      />,
    );

    const cards = container.querySelectorAll('.issue-card');
    expect(cards).toHaveLength(issues.length);
    issues.forEach((iss) => {
      const cardSelectors = container.querySelectorAll(
        `button[aria-label="Open ${iss.id} ${iss.title}"]`,
      );
      expect(cardSelectors).toHaveLength(1);
    });
  });

  it('splits issues into two rows', () => {
    const hasSpecFor = vi.fn().mockReturnValue(false);

    const { container } = render(
      <IssueGroup
        name="Urgent"
        items={issues}
        onOpen={vi.fn()}
        activeId={null}
        hasSpecFor={hasSpecFor}
      />,
    );

    const rows = container.querySelectorAll('.group-row');
    expect(rows).toHaveLength(2);

    const [firstRowCards, secondRowCards] = [rows[0], rows[1]].map((row) =>
      Array.from(row.querySelectorAll('.issue-card')),
    );

    expect(firstRowCards).toHaveLength(2);
    expect(secondRowCards).toHaveLength(2);
    expect(firstRowCards[0].textContent).toContain('FUL-1');
    expect(firstRowCards[1].textContent).toContain('FUL-3');
    expect(secondRowCards[0].textContent).toContain('FUL-2');
    expect(secondRowCards[1].textContent).toContain('FUL-4');
  });

  it('marks active issue card with active class', () => {
    const hasSpecFor = vi.fn().mockReturnValue(false);

    const { container } = render(
      <IssueGroup
        name="Chore"
        items={issues}
        onOpen={vi.fn()}
        activeId="FUL-2"
        hasSpecFor={hasSpecFor}
      />,
    );

    const activeCard = container.querySelector('.issue-card-active');
    const activeButton = container.querySelector('button[aria-label="Open FUL-2 second issue"]');

    expect(activeCard).toBe(activeButton?.closest('.issue-card'));
  });

  it('passes hasSpecFor through to IssueCard', () => {
    const hasSpecFor = vi.fn((id: string) => id === 'FUL-3');

    const { container } = render(
      <IssueGroup
        name="Feature"
        items={issues}
        onOpen={vi.fn()}
        activeId={null}
        hasSpecFor={hasSpecFor}
      />,
    );

    const actionButtons = Array.from(
      container.querySelectorAll('.issue-card .issue-card-actions .btn-ghost'),
    );
    const plainSpecButtons = actionButtons.filter(
      (button) => button.textContent?.trim() === 'Spec',
    );
    const viewSpecButton = actionButtons.find(
      (button) => button.textContent?.trim() === 'View Spec',
    );

    expect(viewSpecButton).toBeTruthy();
    expect(plainSpecButtons).toHaveLength(3);

    if (viewSpecButton) {
      fireEvent.click(viewSpecButton);
    }

    expect(hasSpecFor).toHaveBeenCalledWith('FUL-1');
    expect(hasSpecFor).toHaveBeenCalledWith('FUL-2');
    expect(hasSpecFor).toHaveBeenCalledWith('FUL-3');
    expect(hasSpecFor).toHaveBeenCalledWith('FUL-4');
  });

  it('calls onOpen with issue and which for card and action clicks', () => {
    const onOpen = vi.fn();
    const hasSpecFor = vi.fn().mockReturnValue(false);

    const { container } = render(
      <IssueGroup
        name="Bugs"
        items={issues}
        onOpen={onOpen}
        activeId={null}
        hasSpecFor={hasSpecFor}
      />,
    );

    const issueButtons = container.querySelectorAll('button.issue-card-main');
    const firstCard = container.querySelectorAll('.issue-card')[0];
    const firstCardButtons = firstCard.querySelectorAll('.issue-card-actions button');

    fireEvent.click(issueButtons[0]);
    fireEvent.click(firstCardButtons[1]);

    expect(onOpen).toHaveBeenCalledWith(issues[0], 'spec');
    expect(onOpen).toHaveBeenCalledWith(issues[0], 'detail');
  });
});
