import { beforeEach, describe, expect, it, vi } from 'vitest';

interface LinearSkillModule {
  createLinearClient(opts: { teamKey: string; titlePrefix: string }): {
    fetchIssueComments: (issueId: string) => Promise<
      Array<{
        id: string;
        body: string;
        createdAt: string;
        user: { id: string; name: string } | null;
        botActor: { id: string } | null;
      }>
    >;
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

describe('linear client — fetchIssueComments', () => {
  it('returns the full normalised comment list for an issue id', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          issue: {
            comments: {
              nodes: [
                {
                  id: 'c-1',
                  body: 'hi',
                  createdAt: '2026-05-01T00:00:00.000Z',
                  user: { id: 'u-1', name: 'Alice' },
                  botActor: null,
                },
                {
                  id: 'c-2',
                  body: 'bot comment',
                  createdAt: '2026-05-02T00:00:00.000Z',
                  user: null,
                  botActor: { id: 'bot-1' },
                },
              ],
            },
          },
        },
      }),
    });

    const { createLinearClient } = await getLinearSkillModule();
    const client = createLinearClient({ teamKey: 'FUL', titlePrefix: '' });
    const comments = await client.fetchIssueComments('uuid-issue-1');

    expect(comments).toEqual([
      {
        id: 'c-1',
        body: 'hi',
        createdAt: '2026-05-01T00:00:00.000Z',
        user: { id: 'u-1', name: 'Alice' },
        botActor: null,
      },
      {
        id: 'c-2',
        body: 'bot comment',
        createdAt: '2026-05-02T00:00:00.000Z',
        user: null,
        botActor: { id: 'bot-1' },
      },
    ]);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.variables).toEqual({ issueId: 'uuid-issue-1' });
    expect(body.query).toMatch(/issue\(id: \$issueId\)/);
    expect(body.query).toMatch(/comments\(first: 250\)/);
    expect(body.query).toMatch(/botActor \{\s*id\s*\}/);
    const botActorBlock = body.query.match(/botActor \{[^}]*\}/)?.[0] ?? '';
    expect(botActorBlock).not.toMatch(/name/);
    expect(botActorBlock).not.toMatch(/type/);
  });

  it('returns [] when Linear has no issue', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { issue: null } }),
    });
    const { createLinearClient } = await getLinearSkillModule();
    const client = createLinearClient({ teamKey: 'FUL', titlePrefix: '' });
    await expect(client.fetchIssueComments('missing')).resolves.toEqual([]);
  });

  it('returns [] when comments.nodes is absent', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { issue: { comments: null } } }),
    });
    const { createLinearClient } = await getLinearSkillModule();
    const client = createLinearClient({ teamKey: 'FUL', titlePrefix: '' });
    await expect(client.fetchIssueComments('x')).resolves.toEqual([]);
  });
});
