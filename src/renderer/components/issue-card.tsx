import type { Issue } from '../../shared/types';
import { LabelBadge } from './label-badge';
import { PriorityChip } from './priority-chip';
import { IconChevronRight } from './icons';
import { classifyGroup, type Group } from '../lib/classify';

const GROUP_COLOR: Record<Group, string> = {
  Bugs: 'var(--danger)',
  Urgent: 'var(--warn)',
  Feature: 'var(--accent)',
  Chore: 'var(--text-3)',
};

type IssueCardProps = {
  issue: Issue;
  onOpen: (issue: Issue, which: 'spec' | 'detail') => void;
  isActive: boolean;
  hasSpec: boolean;
};

export function IssueCard({ issue, onOpen, isActive, hasSpec }: IssueCardProps) {
  const group = classifyGroup(issue);
  const firstLabel = issue.labels[0] ?? '';
  const openSpecLabel = `Open ${issue.id} ${issue.title}`;
  const openSpec = () => onOpen(issue, 'spec');
  const specActionLabel = issue.status === 'triage' ? 'Brief' : hasSpec ? 'View Spec' : 'Spec';

  return (
    <div
      className={`issue-card ${isActive ? 'issue-card-active' : ''}`}
      style={{ borderLeftColor: GROUP_COLOR[group] }}
    >
      <button
        type="button"
        className="issue-card-main"
        aria-label={openSpecLabel}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          width: '100%',
          textAlign: 'left',
          background: 'transparent',
          border: 'none',
          padding: 0,
          margin: 0,
          cursor: 'pointer',
          font: 'inherit',
          color: 'inherit',
        }}
        onClick={openSpec}
      >
        <div className="issue-card-top">
          <span className="mono dim">{issue.id}</span>
        </div>
        <div className="issue-card-title">{issue.title}</div>
        <div className="issue-card-meta">
          {firstLabel && <LabelBadge label={firstLabel} />}
          <PriorityChip priority={issue.priority} />
        </div>
      </button>
      <div className="issue-card-actions">
        <button
          className={`btn-ghost ${hasSpec ? 'btn-ghost-accent' : ''}`}
          type="button"
          onClick={() => onOpen(issue, 'spec')}
        >
          {specActionLabel}
        </button>
        <button className="btn-ghost" type="button" onClick={() => onOpen(issue, 'detail')}>
          Detail <IconChevronRight size={10} stroke={2} />
        </button>
      </div>
    </div>
  );
}
