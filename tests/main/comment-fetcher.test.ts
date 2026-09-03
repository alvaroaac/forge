import { describe, expect, it, vi } from 'vitest';
import {
  fetchAndFilterComments,
  type LinearComment,
} from '../../src/main/services/comment-fetcher';

function makeClient(
  rows: Array<{
    id: string;
    body: string;
    createdAt: string;
    user: { id: string; name: string } | null;
    botActor: { id: string } | null;
  }>,
) {
  return { fetchIssueComments: vi.fn().mockResolvedValue(rows) };
}

describe('fetchAndFilterComments', () => {
  it('drops bot rows (botActor !== null) and normalises survivors', async () => {
    const client = makeClient([
      {
        id: 'c-1',
        body: 'human says hi',
        createdAt: '2026-05-01T00:00:00.000Z',
        user: { id: 'u-1', name: 'Alice' },
        botActor: null,
      },
      {
        id: 'c-2',
        body: 'integration noise',
        createdAt: '2026-05-02T00:00:00.000Z',
        user: null,
        botActor: { id: 'bot-1' },
      },
    ]);
    const result = await fetchAndFilterComments(client, 'uuid-1');

    expect(result).toEqual<LinearComment[]>([
      {
        id: 'c-1',
        body: 'human says hi',
        createdAt: '2026-05-01T00:00:00.000Z',
        authorName: 'Alice',
        isBot: false,
      },
    ]);
    expect(client.fetchIssueComments).toHaveBeenCalledWith('uuid-1');
  });

  it('returns [] when client returns []', async () => {
    const client = makeClient([]);
    await expect(fetchAndFilterComments(client, 'x')).resolves.toEqual([]);
  });

  it("falls back authorName to 'Unknown' when user is null and the row survives the bot filter", async () => {
    const client = makeClient([
      {
        id: 'c-3',
        body: 'orphan',
        createdAt: '2026-05-03T00:00:00.000Z',
        user: null,
        botActor: null,
      },
    ]);
    const result = await fetchAndFilterComments(client, 'x');
    expect(result).toEqual<LinearComment[]>([
      {
        id: 'c-3',
        body: 'orphan',
        createdAt: '2026-05-03T00:00:00.000Z',
        authorName: 'Unknown',
        isBot: false,
      },
    ]);
  });

  it('preserves body verbatim and order', async () => {
    const client = makeClient([
      {
        id: 'a',
        body: 'first',
        createdAt: '2026-05-01T00:00:00.000Z',
        user: { id: 'u', name: 'A' },
        botActor: null,
      },
      {
        id: 'b',
        body: 'second',
        createdAt: '2026-05-02T00:00:00.000Z',
        user: { id: 'u', name: 'B' },
        botActor: null,
      },
    ]);
    const result = await fetchAndFilterComments(client, 'x');
    expect(result.map((r) => r.body)).toEqual(['first', 'second']);
  });
});
