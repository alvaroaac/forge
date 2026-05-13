import type { Issue } from '../../shared/types';
import { isBug, mapPriority, mapStatus } from './linear-mapping';

interface LinearClientShape {
  getCurrentUser(): Promise<{ id: string; name: string; email: string }>;
  fetchAssignedIssues(id: string): Promise<RawLinearIssue[]>;
}

export interface RawLinearIssue {
  id: string;
  identifier: string;
  title: string;
  description: string | null;
  state: { name: string; type: string };
  priority: number;
  labels: { nodes: Array<{ name: string }> };
  url: string;
  updatedAt: string;
}

export async function fetchRaw(client: LinearClientShape): Promise<RawLinearIssue[]> {
  const me = await client.getCurrentUser();
  return client.fetchAssignedIssues(me.id);
}

export function mapIssue(raw: RawLinearIssue): Issue {
  const labels = raw.labels.nodes.map((n) => n.name);

  return {
    id: raw.identifier,
    title: raw.title,
    description: raw.description ?? '',
    status: mapStatus(raw.state),
    priority: mapPriority(raw.priority),
    labels,
    url: raw.url,
    updatedAt: raw.updatedAt,
    isBug: isBug({ labels, issueType: null }),
  };
}

export async function fetchIssues(client: LinearClientShape): Promise<Issue[]> {
  const raw = await fetchRaw(client);
  return raw.map(mapIssue);
}
