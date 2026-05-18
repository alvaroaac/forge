import { useEffect, type ReactNode } from 'react';

import type { Issue } from '../../shared/types';
import { IconClose, IconExternal } from './icons';
import { LabelBadge } from './label-badge';
import { PriorityChip } from './priority-chip';

type IssueDrawerTab = {
  key: string;
  label: string;
  isActive: boolean;
  onClick: () => void;
};

type IssueDrawerShellProps = {
  issue: Issue | null;
  onClose: () => void;
  children: ReactNode;
  tabs?: IssueDrawerTab[];
  closeTitle?: string;
  closeAriaLabel?: string;
  closeOnEscape?: boolean;
  renderClosedShell?: boolean;
};

const EMPTY_TABS: IssueDrawerTab[] = [];

function useEscClose(onClose: () => void, enabled: boolean): void {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [enabled, onClose]);
}

function getTabs(tabs: IssueDrawerTab[] | undefined): IssueDrawerTab[] {
  return tabs ?? EMPTY_TABS;
}

function getCloseTitle(closeTitle: string | undefined): string {
  return closeTitle ?? 'Close';
}

function shouldSkipShell(issue: Issue | null, renderClosedShell: boolean | undefined): boolean {
  return issue === null && renderClosedShell === false;
}

function getOpenClass(baseClass: string, openClass: string, open: boolean): string {
  if (open) {
    return `${baseClass} ${openClass}`;
  }

  return baseClass;
}

function IssueDrawerTabs({ tabs }: { tabs: IssueDrawerTab[] }) {
  if (tabs.length === 0) {
    return null;
  }

  return (
    <div className="drawer-tabs">
      {tabs.map((tab) => (
        <button
          className={`drawer-tab ${tab.isActive ? 'drawer-tab-active' : ''}`}
          key={tab.key}
          type="button"
          onClick={tab.onClick}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function IssueDrawerHeader({
  issue,
  onClose,
  tabs,
  closeTitle,
  closeAriaLabel,
}: Required<Pick<IssueDrawerShellProps, 'closeTitle' | 'tabs'>> &
  Pick<IssueDrawerShellProps, 'closeAriaLabel' | 'onClose'> & {
    issue: Issue;
  }) {
  return (
    <div className="drawer-head">
      <div className="drawer-head-row1">
        <span className="mono drawer-id">{issue.id}</span>
        <span className="drawer-title">{issue.title}</span>
        <button
          className="icon-btn"
          type="button"
          onClick={onClose}
          title={closeTitle}
          aria-label={closeAriaLabel}
        >
          <IconClose size={14} />
        </button>
      </div>
      <div className="drawer-head-row2">
        <PriorityChip priority={issue.priority} />
        {issue.labels.map((label) => (
          <LabelBadge key={label} label={label} />
        ))}
        <span style={{ flex: 1 }} />
        <a className="btn-ghost" href={issue.url} target="_blank" rel="noreferrer">
          Linear <IconExternal size={10} stroke={2} />
        </a>
      </div>
      <IssueDrawerTabs tabs={tabs} />
    </div>
  );
}

export function IssueDrawerShell({
  issue,
  onClose,
  children,
  tabs,
  closeTitle,
  closeAriaLabel,
  closeOnEscape,
  renderClosedShell,
}: IssueDrawerShellProps) {
  useEscClose(onClose, closeOnEscape === true);

  if (shouldSkipShell(issue, renderClosedShell)) {
    return null;
  }

  const open = issue !== null;
  const resolvedTabs = getTabs(tabs);
  const resolvedCloseTitle = getCloseTitle(closeTitle);

  return (
    <>
      <div
        className={getOpenClass('drawer-scrim', 'drawer-scrim-open', open)}
        onClick={onClose}
      />
      <aside className={getOpenClass('drawer', 'drawer-open', open)}>
        {issue ? (
          <>
            <IssueDrawerHeader
              issue={issue}
              onClose={onClose}
              tabs={resolvedTabs}
              closeTitle={resolvedCloseTitle}
              closeAriaLabel={closeAriaLabel}
            />
            <div className="drawer-body">{children}</div>
          </>
        ) : null}
      </aside>
    </>
  );
}
