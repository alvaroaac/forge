import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';

import type { Issue } from '../../src/shared/types';

import { IssueGroup } from '../../src/renderer/components/issue-group';

vi.mock('../../src/renderer/components/issue-card', () => ({
  IssueCard: ({
    issue,
    onOpen,
    isActive,
    hasSpec,
  }: {
    issue: Issue;
    onOpen: (issue: Issue, which: 'spec' | 'detail') => void;
    isActive: boolean;
    hasSpec: boolean;
  }) => (
    <div
      data-testid="issue-card"
      data-issue-id={issue.id}
      data-is-active={String(isActive)}
      data-has-spec={String(hasSpec)}
    >
      <span>{issue.id}</span>
      <button type="button" data-testid="open-spec" onClick={() => onOpen(issue, 'spec')}>
        open spec
      </button>
      <button type="button" data-testid="open-detail" onClick={() => onOpen(issue, 'detail')}>
        open detail
      </button>
    </div>
  ),
}));

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

    const cards = container.querySelectorAll(
      '[data-testid="issue-card"]',
    ) as NodeListOf<HTMLElement>;
    expect(cards).toHaveLength(issues.length);
    const issueIds = Array.from(cards).map((card) => card.getAttribute('data-issue-id'));
    expect(issueIds).toEqual(['FUL-1', 'FUL-3', 'FUL-2', 'FUL-4']);
    cards.forEach((card) => {
      expect(card.querySelector('[data-testid="open-spec"]')).toBeTruthy();
      expect(card.querySelector('[data-testid="open-detail"]')).toBeTruthy();
    });
  });

  it('splits even-length issues into two rows', () => {
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

    const firstRowIssueIds = Array.from(rows[0].querySelectorAll('[data-testid="issue-card"]')).map(
      (card) => card.getAttribute('data-issue-id'),
    );
    const secondRowIssueIds = Array.from(
      rows[1].querySelectorAll('[data-testid="issue-card"]'),
    ).map((card) => card.getAttribute('data-issue-id'));

    expect(firstRowIssueIds).toEqual(['FUL-1', 'FUL-3']);
    expect(secondRowIssueIds).toEqual(['FUL-2', 'FUL-4']);
  });

  it('splits odd-length issues into two rows with first row receiving the extra item', () => {
    const hasSpecFor = vi.fn().mockReturnValue(false);

    const { container } = render(
      <IssueGroup
        name="Urgent"
        items={issues.slice(0, 3)}
        onOpen={vi.fn()}
        activeId={null}
        hasSpecFor={hasSpecFor}
      />,
    );

    const rows = container.querySelectorAll('.group-row');
    expect(rows).toHaveLength(2);

    const firstRowIssueIds = Array.from(rows[0].querySelectorAll('[data-testid="issue-card"]')).map(
      (card) => card.getAttribute('data-issue-id'),
    );
    const secondRowIssueIds = Array.from(
      rows[1].querySelectorAll('[data-testid="issue-card"]'),
    ).map((card) => card.getAttribute('data-issue-id'));

    expect(firstRowIssueIds).toEqual(['FUL-1', 'FUL-3']);
    expect(secondRowIssueIds).toEqual(['FUL-2']);
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

    const activeCard = container.querySelector('[data-issue-id="FUL-2"]') as HTMLElement | null;
    const inactiveCards = container.querySelectorAll('[data-issue-id]') as NodeListOf<HTMLElement>;

    expect(activeCard).not.toBeNull();
    expect(activeCard?.getAttribute('data-is-active')).toBe('true');
    expect(
      Array.from(inactiveCards)
        .filter((card) => card.getAttribute('data-issue-id') !== 'FUL-2')
        .every((card) => card.getAttribute('data-is-active') === 'false'),
    ).toBe(true);
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

    const cards = Array.from(container.querySelectorAll('[data-testid="issue-card"]'));
    const specCards = cards.map((card) => card.getAttribute('data-has-spec'));

    expect(specCards).toEqual(['false', 'true', 'false', 'false']);
    expect(hasSpecFor).toHaveBeenCalledTimes(4);
    expect(hasSpecFor).toHaveBeenNthCalledWith(1, 'FUL-1');
    expect(hasSpecFor).toHaveBeenNthCalledWith(2, 'FUL-3');
    expect(hasSpecFor).toHaveBeenNthCalledWith(3, 'FUL-2');
    expect(hasSpecFor).toHaveBeenNthCalledWith(4, 'FUL-4');
  });

  it('calls onOpen with issue and which for mocked card buttons with exact counts', () => {
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

    const cards = container.querySelectorAll('[data-testid="issue-card"]');

    cards.forEach((card) => {
      const specButton = card.querySelector('[data-testid="open-spec"]') as HTMLButtonElement;
      const detailButton = card.querySelector('[data-testid="open-detail"]') as HTMLButtonElement;
      fireEvent.click(specButton);
      fireEvent.click(detailButton);
    });

    expect(onOpen).toHaveBeenCalledTimes(8);
    expect(onOpen).toHaveBeenNthCalledWith(1, issues[0], 'spec');
    expect(onOpen).toHaveBeenNthCalledWith(2, issues[0], 'detail');
    expect(onOpen).toHaveBeenNthCalledWith(3, issues[2], 'spec');
    expect(onOpen).toHaveBeenNthCalledWith(4, issues[2], 'detail');
    expect(onOpen).toHaveBeenNthCalledWith(5, issues[1], 'spec');
    expect(onOpen).toHaveBeenNthCalledWith(6, issues[1], 'detail');
    expect(onOpen).toHaveBeenNthCalledWith(7, issues[3], 'spec');
    expect(onOpen).toHaveBeenNthCalledWith(8, issues[3], 'detail');
  });
});
