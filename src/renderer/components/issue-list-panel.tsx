import { classifyGroup, type Group } from '../lib/classify';
import type { Issue, IssueStatus } from '../../shared/types';

import { IconRefresh } from './icons';
import { IssueGroup } from './issue-group';
import { PillTab } from './pill-tab';

export type Tab = 'Todo' | 'In Progress' | 'In Review' | 'Done';

const TABS: Tab[] = ['Todo', 'In Progress', 'In Review', 'Done'];

const TAB_KEY: Record<Tab, IssueStatus> = {
  Todo: 'todo',
  'In Progress': 'in_progress',
  'In Review': 'in_review',
  Done: 'done',
};

const GROUP_ORDER: Group[] = ['Bugs', 'Urgent', 'Feature', 'Chore'];

type IssueListPanelProps = {
  issues: Issue[];
  tab: Tab;
  setTab: (next: Tab) => void;
  onOpen: (issue: Issue, which: 'spec' | 'detail') => void;
  activeId: string | null;
  hasSpecFor: (issueId: string) => boolean;
  onRefresh: () => void;
};

function counts(issues: Issue[]) {
  return TABS.reduce(
    (memo, tab) => {
      memo[tab] = issues.filter((issue) => issue.status === TAB_KEY[tab]).length;
      return memo;
    },
    {} as Record<Tab, number>,
  );
}

function groupVisible(visibleIssues: Issue[]) {
  return GROUP_ORDER.map((groupName) => ({
    name: groupName,
    items: visibleIssues.filter((issue) => classifyGroup(issue) === groupName),
  })).filter((group) => group.items.length > 0);
}

export function IssueListPanel({
  issues,
  tab,
  setTab,
  onOpen,
  activeId,
  hasSpecFor,
  onRefresh,
}: IssueListPanelProps) {
  const visibleIssues = issues.filter((issue) => issue.status === TAB_KEY[tab]);
  const visibleGroups = groupVisible(visibleIssues);
  const issueCounts = counts(issues);

  return (
    <div className="panel-left">
      <div className="panel-left-head">
        <div className="tabs">
          {TABS.map((item) => (
            <PillTab
              key={item}
              active={tab === item}
              count={issueCounts[item]}
              onClick={() => setTab(item)}
            >
              {item}
            </PillTab>
          ))}
        </div>
        <div className="panel-left-tools">
          <button
            className="icon-btn"
            type="button"
            aria-label="Refresh"
            title="Refresh"
            onClick={onRefresh}
          >
            <IconRefresh size={12} />
          </button>
        </div>
      </div>
      <div className="panel-left-body">
        {visibleGroups.length === 0 ? (
          <div className="empty">No issues in {tab.toLowerCase()}.</div>
        ) : (
          visibleGroups.map((group) => (
            <IssueGroup
              key={group.name}
              name={group.name}
              items={group.items}
              onOpen={onOpen}
              activeId={activeId}
              hasSpecFor={hasSpecFor}
            />
          ))
        )}
      </div>
    </div>
  );
}
