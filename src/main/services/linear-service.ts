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
