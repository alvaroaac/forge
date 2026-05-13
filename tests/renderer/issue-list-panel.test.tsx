import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';

import type { Issue } from '../../src/shared/types';
import { type Group, classifyGroup } from '../../src/renderer/lib/classify';

import { IssueListPanel } from '../../src/renderer/components/issue-list-panel';

vi.mock('../../src/renderer/components/issue-group', () => ({
  IssueGroup: ({
    name,
    items,
    onOpen,
    activeId,
    hasSpecFor,
  }: {
    name: Group;
    items: Issue[];
    onOpen: (issue: Issue, which: 'spec' | 'detail') => void;
    activeId: string | null;
    hasSpecFor: (issueId: string) => boolean;
  }) => (
    <section data-testid="issue-group" data-group-name={name} data-active-id={activeId ?? ''}>
      {items.map((issue) => (
        <article
          key={issue.id}
          data-testid="issue-card"
          data-issue-id={issue.id}
          data-has-spec={String(hasSpecFor(issue.id))}
        >
          <span data-testid="issue-id">{issue.id}</span>
          <button type="button" onClick={() => onOpen(issue, 'detail')} data-open="detail">
            open detail
          </button>
        </article>
      ))}
    </section>
  ),
}));

vi.mock('../../src/renderer/lib/classify', async () => {
  const actual = await vi.importActual<typeof import('../../src/renderer/lib/classify')>(
    '../../src/renderer/lib/classify',
  );
  return {
    ...actual,
    classifyGroup: vi.fn(),
  };
});

const issues: Issue[] = [
  {
    id: 'FUL-1',
    title: 'first',
    description: '',
    status: 'todo',
    priority: 'urgent',
    labels: ['frontend'],
    url: '',
    updatedAt: '',
    isBug: true,
  },
  {
    id: 'FUL-2',
    title: 'second',
    description: '',
    status: 'todo',
    priority: 'medium',
    labels: ['backend'],
    url: '',
    updatedAt: '',
    isBug: false,
  },
  {
    id: 'FUL-3',
    title: 'third',
    description: '',
    status: 'in_progress',
    priority: 'high',
    labels: ['feature'],
    url: '',
    updatedAt: '',
    isBug: false,
  },
  {
    id: 'FUL-4',
    title: 'fourth',
    description: '',
    status: 'done',
    priority: 'low',
    labels: ['chore'],
    isBug: true,
    url: '',
    updatedAt: '',
  },
];

const classifyByIssueId: Record<string, Group> = {
  'FUL-1': 'Bugs',
  'FUL-2': 'Urgent',
  'FUL-3': 'Feature',
  'FUL-4': 'Chore',
};

function getTabCount(label: RegExp) {
  const tab = screen.getByRole('button', { name: label });
  return Number(tab.querySelector('.tab-count')?.textContent ?? 'NaN');
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(classifyGroup).mockImplementation((issue: Issue) => classifyByIssueId[issue.id]);
});

afterEach(() => {
  cleanup();
});

describe('IssueListPanel', () => {
  it('filters visible issues by selected tab', () => {
    render(
      <IssueListPanel
        issues={issues}
        tab="Todo"
        setTab={vi.fn()}
        onOpen={vi.fn()}
        activeId={null}
        hasSpecFor={vi.fn()}
        onRefresh={vi.fn()}
      />,
    );

    const renderedIssueIds = screen.getAllByTestId('issue-group').flatMap((group) =>
      within(group)
        .getAllByTestId('issue-id')
        .map((node) => node.textContent),
    );

    expect(renderedIssueIds).toEqual(['FUL-1', 'FUL-2']);
  });

  it('calls setTab when clicking a tab', () => {
    const setTab = vi.fn();
    render(
      <IssueListPanel
        issues={[]}
        tab="Todo"
        setTab={setTab}
        onOpen={vi.fn()}
        activeId={null}
        hasSpecFor={vi.fn()}
        onRefresh={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /^In Progress/i }));
    expect(setTab).toHaveBeenCalledWith('In Progress');
    expect(setTab).toHaveBeenCalledTimes(1);
  });

  it('shows correct counts in tabs', () => {
    render(
      <IssueListPanel
        issues={issues}
        tab="Todo"
        setTab={vi.fn()}
        onOpen={vi.fn()}
        activeId={null}
        hasSpecFor={vi.fn()}
        onRefresh={vi.fn()}
      />,
    );

    expect(getTabCount(/^Todo/i)).toBe(2);
    expect(getTabCount(/^In Progress/i)).toBe(1);
    expect(getTabCount(/^In Review/i)).toBe(0);
    expect(getTabCount(/^Done/i)).toBe(1);

    expect(screen.getByRole('button', { name: /^Todo/i }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(screen.getByRole('button', { name: /^In Progress/i }).getAttribute('aria-pressed')).toBe(
      'false',
    );
  });

  it('orders visible groups by GROUP_ORDER and derives groups via classifyGroup', () => {
    vi.mocked(classifyGroup).mockImplementation((issue: Issue) => {
      const map: Record<string, Group> = {
        'FUL-A': 'Chore',
        'FUL-B': 'Bugs',
        'FUL-C': 'Feature',
        'FUL-D': 'Urgent',
      };
      return map[issue.id];
    });

    render(
      <IssueListPanel
        issues={[
          {
            id: 'FUL-A',
            title: 'alpha',
            description: '',
            status: 'in_progress',
            priority: 'low',
            labels: [],
            url: '',
            updatedAt: '',
            isBug: false,
          },
          {
            id: 'FUL-B',
            title: 'bravo',
            description: '',
            status: 'in_progress',
            priority: 'low',
            labels: [],
            url: '',
            updatedAt: '',
            isBug: false,
          },
          {
            id: 'FUL-C',
            title: 'charlie',
            description: '',
            status: 'in_progress',
            priority: 'low',
            labels: [],
            url: '',
            updatedAt: '',
            isBug: false,
          },
          {
            id: 'FUL-D',
            title: 'delta',
            description: '',
            status: 'in_progress',
            priority: 'low',
            labels: [],
            url: '',
            updatedAt: '',
            isBug: false,
          },
          {
            id: 'FUL-H',
            title: 'hidden',
            description: '',
            status: 'done',
            priority: 'low',
            labels: [],
            url: '',
            updatedAt: '',
            isBug: false,
          },
        ]}
        tab="In Progress"
        setTab={vi.fn()}
        onOpen={vi.fn()}
        activeId={null}
        hasSpecFor={vi.fn()}
        onRefresh={vi.fn()}
      />,
    );

    const groupSections = screen.getAllByTestId('issue-group');
    const names = groupSections.map((group) => group.getAttribute('data-group-name'));
    expect(names).toEqual(['Bugs', 'Urgent', 'Feature', 'Chore']);

    const calls = vi.mocked(classifyGroup).mock.calls.map(([issue]) => issue.id as string);
    const uniqueCalls = Array.from(new Set(calls));
    expect(uniqueCalls.sort()).toEqual(['FUL-A', 'FUL-B', 'FUL-C', 'FUL-D']);
  });

  it('forwards hasSpecFor, onOpen, and activeId to IssueGroup', () => {
    const hasSpecFor = vi.fn((id: string) => id === 'FUL-1');
    const onOpen = vi.fn();
    render(
      <IssueListPanel
        issues={issues}
        tab="Todo"
        setTab={vi.fn()}
        onOpen={onOpen}
        activeId="FUL-2"
        hasSpecFor={hasSpecFor}
        onRefresh={vi.fn()}
      />,
    );

    const groups = screen.getAllByTestId('issue-group');
    expect(groups).toHaveLength(2);
    groups.forEach((group) => expect(group.getAttribute('data-active-id')).toBe('FUL-2'));
    const issueCards = screen.getAllByTestId('issue-card');
    expect(hasSpecFor).toHaveBeenCalledTimes(2);
    expect(issueCards[0].getAttribute('data-has-spec')).toBe('true');
    expect(issueCards[1].getAttribute('data-has-spec')).toBe('false');

    fireEvent.click(within(issueCards[0]).getByText('open detail'));
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onOpen).toHaveBeenCalledWith(issues[0], 'detail');
  });

  it('calls onRefresh when refresh button is clicked', () => {
    const onRefresh = vi.fn();
    render(
      <IssueListPanel
        issues={[]}
        tab="Todo"
        setTab={vi.fn()}
        onOpen={vi.fn()}
        activeId={null}
        hasSpecFor={vi.fn()}
        onRefresh={onRefresh}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /refresh/i }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('shows empty state when no issues are visible', () => {
    render(
      <IssueListPanel
        issues={issues}
        tab="In Review"
        setTab={vi.fn()}
        onOpen={vi.fn()}
        activeId={null}
        hasSpecFor={vi.fn()}
        onRefresh={vi.fn()}
      />,
    );

    expect(screen.getByText('No issues in in review.')).toBeTruthy();
  });
});
