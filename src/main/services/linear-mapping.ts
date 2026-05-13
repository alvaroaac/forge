import type { Priority } from '../../shared/types';

const PRIORITY_TABLE: Record<number, Priority> = {
  1: 'urgent',
  2: 'high',
  3: 'medium',
  4: 'low',
  0: 'none',
};

export function mapPriority(n: number): Priority {
  return PRIORITY_TABLE[n] ?? 'none';
}
