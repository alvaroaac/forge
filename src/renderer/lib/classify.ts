import type { Issue } from '../../shared/types';

export type Group = 'Bugs' | 'Urgent' | 'Feature' | 'Chore';

export function classifyGroup(issue: Issue): Group {
  if (issue.isBug) return 'Bugs';
  if (issue.priority === 'urgent') return 'Urgent';
  if (issue.labels.some((label) => label.toLowerCase() === 'chore')) return 'Chore';
  return 'Feature';
}
