import { describe, expect, it } from 'vitest';
import { fetchTriage, type RawLinearIssue } from '../../src/main/services/linear-service';

describe('fetchTriage', () => {
  it('maps raw triage issues to Issue and threads assigneeId', async () => {
    const raw: RawLinearIssue[] = [
      {
        id: 'i1',
        identifier: 'FUL-7',
        title: 't',
        description: null,
        state: { name: 'Triage', type: 'triage' },
        priority: 0,
        labels: { nodes: [] },
        url: '',
        updatedAt: '',
        assignee: { id: 'me' },
      },
    ];
    const client = {
      fetchTeamTriage: async () => raw,
    };

    const issues = await fetchTriage(client);

    expect(issues).toHaveLength(1);
    expect(issues[0].status).toBe('triage');
    expect(issues[0].assigneeId).toBe('me');
  });
});
