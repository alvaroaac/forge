import type { IssueStatus, Priority } from '../../shared/types';

const PRIORITY_TABLE: Record<number, Priority> = {
  1: 'urgent',
  2: 'high',
  3: 'medium',
  4: 'low',
  0: 'none',
};
const BUG_RX = /^bug$/i;
const STATUS_TABLE: Record<string, IssueStatus> = {
  triage: 'todo',
  backlog: 'todo',
  unstarted: 'todo',
  started: 'in_progress',
  review: 'in_review',
  completed: 'done',
  canceled: 'done',
};

export function mapPriority(n: number): Priority {
  return PRIORITY_TABLE[n] ?? 'none';
}

export function mapStatus(state: { name: string; type: string }): IssueStatus {
  return STATUS_TABLE[state.type] ?? 'todo';
}

export function isBug(input: { labels: string[]; issueType: { name: string } | null }): boolean {
  if (input.labels.some((l) => BUG_RX.test(l))) return true;
  return BUG_RX.test(input.issueType?.name ?? '');
}
