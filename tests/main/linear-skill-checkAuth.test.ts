import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

interface LinearSkillModule {
  createLinearClient(opts: { teamKey: string; titlePrefix: string }): {
    checkAuth: (tokenPath?: string) => Promise<boolean>;
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
  delete process.env.LINEAR_API_KEY;
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('linear client — checkAuth', () => {
  it('returns true when the configured OAuth token can query viewer id', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'forge-linear-auth-'));
    const tokenPath = join(dir, 'linear.json');
    writeFileSync(tokenPath, JSON.stringify({ access_token: 'oauth-token' }), 'utf-8');
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { viewer: { id: 'u1' } } }),
    });

    const { createLinearClient } = await getLinearSkillModule();
    const client = createLinearClient({ teamKey: 'FUL', titlePrefix: '' });

    await expect(client.checkAuth(tokenPath)).resolves.toBe(true);
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer oauth-token');
  });

  it('prefers LINEAR_API_KEY over the configured OAuth token path', async () => {
    process.env.LINEAR_API_KEY = 'api-key';
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { viewer: { id: 'u1' } } }),
    });

    const { createLinearClient } = await getLinearSkillModule();
    const client = createLinearClient({ teamKey: 'FUL', titlePrefix: '' });

    await expect(client.checkAuth('/tmp/missing-linear-token.json')).resolves.toBe(true);
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('api-key');
  });

  it('returns false for missing auth, HTTP failures, GraphQL errors, and missing viewer id', async () => {
    const { createLinearClient } = await getLinearSkillModule();
    const client = createLinearClient({ teamKey: 'FUL', titlePrefix: '' });

    await expect(client.checkAuth('/tmp/missing-linear-token.json')).resolves.toBe(false);

    process.env.LINEAR_API_KEY = 'api-key';
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) });
    await expect(client.checkAuth('/tmp/missing-linear-token.json')).resolves.toBe(false);

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ errors: [{ message: 'AUTHENTICATION_ERROR' }] }),
    });
    await expect(client.checkAuth('/tmp/missing-linear-token.json')).resolves.toBe(false);

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { viewer: null } }),
    });
    await expect(client.checkAuth('/tmp/missing-linear-token.json')).resolves.toBe(false);
  });
});
