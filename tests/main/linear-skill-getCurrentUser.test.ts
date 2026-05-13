import { describe, it, expect, vi, beforeEach } from 'vitest';

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
    // @ts-expect-error linear skill module is an mjs reference file without generated d.ts in tests
    const { createLinearClient } = await import('../../.agents/skills/linear/reference/linear.mjs');
    const client = createLinearClient({ teamKey: 'FUL', titlePrefix: '' });
    const me = await client.getCurrentUser();
    expect(me).toEqual({ id: 'u1', name: 'Al', email: 'a@b' });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.query).toMatch(/viewer/);
  });
});
