import { describe, it, expect, vi, beforeEach } from 'vitest';

interface LinearSkillModule {
  createLinearClient(opts: { teamKey: string; titlePrefix: string }): {
    getCurrentUser: () => Promise<{ id: string; name: string; email: string }>;
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

describe('linear client — getCurrentUser', () => {
  it('returns viewer id, name, email', async () => {
    fetchMock.mockResolvedValueOnce({
      json: async () => ({ data: { viewer: { id: 'u1', name: 'Al', email: 'a@b' } } }),
    });
    const { createLinearClient } = await getLinearSkillModule();
    const client = createLinearClient({ teamKey: 'FUL', titlePrefix: '' });
    const me = await client.getCurrentUser();
    expect(me).toEqual({ id: 'u1', name: 'Al', email: 'a@b' });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.query).toMatch(/viewer/);
  });
});
