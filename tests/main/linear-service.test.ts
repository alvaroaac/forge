import { describe, expect, it, vi } from 'vitest';
import { fetchRaw, RawLinearIssue } from '../../src/main/services/linear-service';

type LinearClientShape = {
  getCurrentUser: () => Promise<{ id: string; name: string; email: string }>;
  fetchAssignedIssues: (id: string) => Promise<RawLinearIssue[]>;
};

describe('linear-service.fetchRaw', () => {
  it('calls getCurrentUser then fetchAssignedIssues', async () => {
    const me = { id: 'u1', name: 'a', email: 'b' };
    const issue = {
      id: 'i1',
      identifier: 'FUL-1',
      title: 'sample',
      description: 'desc',
      state: { name: 'Todo', type: 'unstarted' },
      priority: 2,
      labels: { nodes: [{ name: 'bug' }] },
      url: 'https://linear.app/space/issue/FUL-1',
      updatedAt: '2026-05-12T00:00:00.000Z',
    } satisfies RawLinearIssue;

    const client: LinearClientShape = {
      getCurrentUser: vi.fn().mockResolvedValue(me),
      fetchAssignedIssues: vi.fn().mockResolvedValue([issue]),
    };

    const raw = await fetchRaw(client);

    expect(client.getCurrentUser).toHaveBeenCalled();
    expect(client.fetchAssignedIssues).toHaveBeenCalledWith('u1');
    expect(raw).toEqual([issue]);
  });
});
