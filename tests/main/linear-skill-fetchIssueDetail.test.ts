import { beforeEach, describe, expect, it, vi } from 'vitest';

interface LinearSkillModule {
  createLinearClient(opts: { teamKey: string; titlePrefix: string }): {
    fetchIssueDetail: (identifier: string) => Promise<{
      id: string;
      identifier: string;
      title: string;
      description: string | null;
      state: { name: string; type: string };
      priority: number;
      labels: { nodes: Array<{ name: string }> };
      url: string;
      updatedAt: string;
    } | null>;
  };
}

async function getLinearSkillModule(): Promise<LinearSkillModule> {
  const modulePath = '../../.agents/skills/linear/reference/linear.mjs';
  const mod = await import(modulePath as string);
  return mod as unknown as LinearSkillModule;
}

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

beforeEach(() => {
  fetchMock.mockReset();
  process.env.LINEAR_API_KEY = 'test-key';
});

describe('linear client — fetchIssueDetail', () => {
  it('returns full single-issue detail by identifier', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          issue: {
            id: 'uuid-1',
            identifier: 'FUL-1',
            title: 'Thing',
            description: 'Fresh detail',
            state: { name: 'Todo', type: 'unstarted' },
            priority: 2,
            labels: { nodes: [{ name: 'bug' }, { name: 'ops' }] },
            url: 'https://linear.app/acme/issue/FUL-1',
            updatedAt: '2026-05-13T00:00:00.000Z',
          },
        },
      }),
    });

    const { createLinearClient } = await getLinearSkillModule();
    const client = createLinearClient({ teamKey: 'FUL', titlePrefix: '' });
    const issue = await client.fetchIssueDetail('FUL-1');

    expect(issue).toEqual({
      id: 'uuid-1',
      identifier: 'FUL-1',
      title: 'Thing',
      description: 'Fresh detail',
      state: { name: 'Todo', type: 'unstarted' },
      priority: 2,
      labels: { nodes: [{ name: 'bug' }, { name: 'ops' }] },
      url: 'https://linear.app/acme/issue/FUL-1',
      updatedAt: '2026-05-13T00:00:00.000Z',
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.variables).toEqual({ identifier: 'FUL-1' });
    expect(body.query).toMatch(/issue\(id: \$identifier\)/);
    expect(body.query).toMatch(/description/);
    expect(body.query).toMatch(/updatedAt/);
  });

  it('returns null when Linear does not return an issue', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { issue: null } }),
    });

    const { createLinearClient } = await getLinearSkillModule();
    const client = createLinearClient({ teamKey: 'FUL', titlePrefix: '' });

    await expect(client.fetchIssueDetail('FUL-404')).resolves.toBeNull();
  });
});
