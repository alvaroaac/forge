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
    assigneeId: null,
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
    assigneeId: null,
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
    assigneeId: null,
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
    assigneeId: null,
  },
  {
    id: 'FUL-5',
    title: 'triage mine',
    description: '',
    status: 'triage',
    priority: 'high',
    labels: ['triage'],
    url: '',
    updatedAt: '',
    isBug: false,
    assigneeId: 'viewer-1',
  },
  {
    id: 'FUL-6',
    title: 'triage other',
    description: '',
    status: 'triage',
    priority: 'medium',
    labels: ['triage'],
    url: '',
    updatedAt: '',
    isBug: false,
    assigneeId: 'viewer-2',
  },
];

const classifyByIssueId: Record<string, Group> = {
  'FUL-1': 'Bugs',
  'FUL-2': 'Urgent',
  'FUL-3': 'Feature',
  'FUL-4': 'Chore',
  'FUL-5': 'Bugs',
  'FUL-6': 'Bugs',
};

function getTabCount(label: RegExp) {
  const tab = screen.getByRole('button', { name: label });
  return Number(tab.querySelector('.tab-count')?.textContent ?? 'NaN');
}

function renderPanel(
  overrides: Partial<{
    issues: Issue[];
    tab: Parameters<typeof IssueListPanel>[0]['tab'];
    setTab: (next: Parameters<typeof IssueListPanel>[0]['tab']) => void;
    onOpen: (issue: Issue, which: 'spec' | 'detail') => void;
    activeId: string | null;
    hasSpecFor: (issueId: string) => boolean;
    onRefresh: () => void;
    mineOnly: boolean;
    onMineOnlyChange: (next: boolean) => void;
    viewerId: string | null;
  }> = {},
) {
  const {
    issues: inputIssues = issues,
    tab = 'Todo',
    setTab = vi.fn(),
    onOpen = vi.fn(),
    activeId = null,
    hasSpecFor = vi.fn(),
    onRefresh = vi.fn(),
    mineOnly = false,
    onMineOnlyChange = vi.fn(),
    viewerId = null,
  } = overrides;

  return render(
    <IssueListPanel
      issues={inputIssues}
      tab={tab}
      setTab={setTab}
      onOpen={onOpen}
      activeId={activeId}
      hasSpecFor={hasSpecFor}
      onRefresh={onRefresh}
      mineOnly={mineOnly}
      onMineOnlyChange={onMineOnlyChange}
      viewerId={viewerId}
    />,
  );
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
    renderPanel({ tab: 'Todo' });

    const renderedIssueIds = screen.getAllByTestId('issue-group').flatMap((group) =>
      within(group)
        .getAllByTestId('issue-id')
        .map((node) => node.textContent),
    );

    expect(renderedIssueIds).toEqual(['FUL-1', 'FUL-2']);
  });

  it('calls setTab when clicking a tab', () => {
    const setTab = vi.fn();
    renderPanel({ issues: [], tab: 'Todo', setTab });

    fireEvent.click(screen.getByRole('button', { name: /^In Progress/i }));
    expect(setTab).toHaveBeenCalledWith('In Progress');
    expect(setTab).toHaveBeenCalledTimes(1);
  });

  it('shows correct counts in tabs', () => {
    renderPanel({ tab: 'Todo' });

    expect(getTabCount(/^Todo/i)).toBe(2);
    expect(getTabCount(/^Triage/i)).toBe(2);
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

    renderPanel({
      issues: [
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
          assigneeId: null,
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
          assigneeId: null,
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
          assigneeId: null,
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
          assigneeId: null,
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
          assigneeId: null,
        },
      ],
      tab: 'In Progress',
    });

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
    renderPanel({
      tab: 'Todo',
      issues,
      activeId: 'FUL-2',
      onOpen,
      hasSpecFor,
    });

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
    renderPanel({ issues: [], tab: 'Todo', onRefresh });

    fireEvent.click(screen.getByRole('button', { name: /refresh/i }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('shows empty state when no issues are visible', () => {
    renderPanel({ tab: 'In Review' });

    expect(screen.getByText('No issues in in review.')).toBeTruthy();
  });

  it('renders Triage as first tab and shows status counts for all issues', () => {
    renderPanel({ tab: 'Triage' });

    const tabElements = screen.getAllByRole('button', {
      name: /Todo|In Progress|In Review|Done|Triage/,
    });
    expect(tabElements[0].textContent).toContain('Triage');
    expect(tabElements[1].textContent).toContain('Todo');
    expect(tabElements[2].textContent).toContain('In Progress');
    expect(tabElements[3].textContent).toContain('In Review');
    expect(tabElements[4].textContent).toContain('Done');

    expect(getTabCount(/^Triage/i)).toBe(2);
    expect(screen.getAllByTestId('issue-card')).toHaveLength(2);
  });

  it('shows Mine only toggle only for the Triage tab', () => {
    renderPanel({ tab: 'Todo' });
    expect(screen.queryByRole('checkbox', { name: /mine only/i })).toBeNull();

    cleanup();
    renderPanel({ tab: 'Triage' });
    expect(screen.getByRole('checkbox', { name: /mine only/i })).toBeTruthy();
  });

  it('filters triage issues by viewerId when Mine only is on', () => {
    renderPanel({
      tab: 'Triage',
      mineOnly: true,
      viewerId: 'viewer-1',
    });

    const visibleIssues = screen.getAllByTestId('issue-id').map((node) => node.textContent);
    expect(visibleIssues).toEqual(['FUL-5']);
  });
});
