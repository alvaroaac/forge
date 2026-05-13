import type { Priority } from '../../shared/types';

const PRIORITY_TABLE: Record<number, Priority> = {
  1: 'urgent',
  2: 'high',
  3: 'medium',
  4: 'low',
  0: 'none',
};
const BUG_RX = /^bug$/i;

export function mapPriority(n: number): Priority {
  return PRIORITY_TABLE[n] ?? 'none';
}

export function isBug(input: { labels: string[]; issueType: { name: string } | null }): boolean {
  if (input.labels.some((l) => BUG_RX.test(l))) return true;
  return BUG_RX.test(input.issueType?.name ?? '');
}
