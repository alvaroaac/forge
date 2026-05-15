import { describe, it, expect, vi, beforeEach } from 'vitest';

interface LinearSkillModule {
  createLinearClient(opts: { teamKey: string; titlePrefix: string }): {
    fetchTeamTriage: () => Promise<
      Array<{
        id: string;
        identifier: string;
        title: string;
        description: string;
        state: { name: string; type: string };
        priority: number;
        labels: { nodes: Array<{ name: string }> };
        url: string;
        updatedAt: string;
        assignee: { id: string } | null;
      }>
    >;
  };
}

async function getLinearSkillModule(): Promise<LinearSkillModule> {
  const modulePath = '../../.agents/skills/linear/reference/linear.mjs';
  const mod = await import(modulePath as string);
  return mod as unknown as LinearSkillModule;
}

// Intercept fetch
const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

beforeEach(() => {
  fetchMock.mockReset();
  process.env.LINEAR_API_KEY = 'test-key';
});

describe('linear client — fetchTeamTriage', () => {
  it('returns raw team triage issues with assignee and filters by triage state', async () => {
    fetchMock.mockResolvedValueOnce({
      json: async () => ({
        data: {
          issues: {
            nodes: [
              {
                id: 'i1',
                identifier: 'FUL-10',
                title: 'triage one',
                description: 'triage body 1',
                state: { name: 'Triage', type: 'triage' },
                priority: 1,
                labels: { nodes: [{ name: 'triage' }] },
                url: 'https://linear.app/foo/issue/FUL-10',
                updatedAt: '2026-05-12T00:00:00Z',
                assignee: null,
              },
              {
                id: 'i2',
                identifier: 'FUL-11',
                title: 'triage two',
                description: 'triage body 2',
                state: { name: 'Triage', type: 'triage' },
                priority: 2,
                labels: { nodes: [{ name: 'backend' }] },
                url: 'https://linear.app/foo/issue/FUL-11',
                updatedAt: '2026-05-12T00:00:00Z',
                assignee: { id: 'u42' },
              },
            ],
          },
        },
      }),
    });

    const { createLinearClient } = await getLinearSkillModule();
    const client = createLinearClient({ teamKey: 'FUL', titlePrefix: '' });
    const items = await client.fetchTeamTriage();

    expect(items).toHaveLength(2);
    expect(items[0].assignee).toBeNull();
    expect(items[1].assignee).toEqual({ id: 'u42' });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.variables).toEqual({ teamKey: 'FUL' });
    expect(body.query).toContain('state: { type: { eq: "triage" } }');
    expect(body.query).toContain('team: { key: { eq: $teamKey } }');
  });
});
