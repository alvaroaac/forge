import type { CSSProperties, ComponentType } from 'react';

import type { Issue } from '../../shared/types';
import { IconBug, IconFlame, IconSpark, IconTerminal } from './icons';
import { IssueCard } from './issue-card';
import { Group } from '../lib/classify';

type IconProps = {
  size?: number;
  stroke?: number;
  style?: CSSProperties;
};

const META: Record<Group, { color: string; Icon: ComponentType<IconProps> }> = {
  Bugs: { color: 'var(--danger)', Icon: IconBug },
  Urgent: { color: 'var(--warn)', Icon: IconFlame },
  Feature: { color: 'var(--accent)', Icon: IconSpark },
  Chore: { color: 'var(--text-3)', Icon: IconTerminal },
};

function intoRows<T>(items: T[]): [T[], T[]] {
  const rows: [T[], T[]] = [[], []];
  items.forEach((item, index) => {
    rows[index % 2].push(item);
  });
  return rows;
}

type IssueGroupProps = {
  name: Group;
  items: Issue[];
  onOpen: (issue: Issue, which: 'spec' | 'detail') => void;
  activeId: string | null;
  hasSpecFor: (issueId: string) => boolean;
};

export function IssueGroup({ name, items, onOpen, activeId, hasSpecFor }: IssueGroupProps) {
  const [firstRow, secondRow] = intoRows(items);
  const { color, Icon } = META[name];

  return (
    <section className="group">
      <div className="group-head">
        <span className="group-head-left">
          <Icon size={11} stroke={2} style={{ color }} />
          <span className="group-name">{name}</span>
          <span className="group-count mono">{items.length}</span>
        </span>
      </div>

      <div className="group-scroller-wrap">
        <div className="group-scroller">
          {[firstRow, secondRow].map((row, rowIndex) => (
            <div className="group-row" key={rowIndex}>
              {row.map((issue) => (
                <IssueCard
                  key={issue.id}
                  issue={issue}
                  onOpen={onOpen}
                  isActive={issue.id === activeId}
                  hasSpec={hasSpecFor(issue.id)}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
