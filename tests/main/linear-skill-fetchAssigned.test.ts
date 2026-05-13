import { describe, it, expect, vi, beforeEach } from 'vitest';

interface LinearSkillModule {
  createLinearClient(opts: { teamKey: string; titlePrefix: string }): {
    fetchAssignedIssues: (assigneeId: string) => Promise<
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

describe('linear client — fetchAssignedIssues', () => {
  it('returns raw issues for assignee within team', async () => {
    fetchMock.mockResolvedValueOnce({
      json: async () => ({
        data: {
          issues: {
            nodes: [
              {
                id: 'i1',
                identifier: 'FUL-1',
                title: 'thing',
                description: 'body',
                state: { name: 'Todo', type: 'unstarted' },
                priority: 2,
                labels: { nodes: [{ name: 'bug' }] },
                url: 'https://linear.app/foo',
                updatedAt: '2026-05-12T00:00:00Z',
              },
            ],
          },
        },
      }),
    });

    const { createLinearClient } = await getLinearSkillModule();
    const client = createLinearClient({ teamKey: 'FUL', titlePrefix: '' });
    const items = await client.fetchAssignedIssues('u1');

    expect(items).toHaveLength(1);
    expect(items[0].identifier).toBe('FUL-1');
    expect(items[0].state.type).toBe('unstarted');

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.variables).toEqual({ assigneeId: 'u1', teamKey: 'FUL' });
  });
});
