import { describe, expect, it, vi } from 'vitest';
import {
  fetchIssueDetail,
  fetchRaw,
  mapIssue,
  RawLinearIssue,
} from '../../src/main/services/linear-service';

type LinearClientShape = {
  getCurrentUser: () => Promise<{ id: string; name: string; email: string }>;
  fetchAssignedIssues: (id: string) => Promise<RawLinearIssue[]>;
};

describe('mapIssue', () => {
  it('maps raw Linear issue to internal Issue', () => {
    const out = mapIssue({
      id: 'i1',
      identifier: 'FUL-7',
      title: 'thing',
      description: 'body',
      state: { name: 'Todo', type: 'unstarted' },
      priority: 2,
      labels: { nodes: [{ name: 'bug' }, { name: 'web' }] },
      url: 'https://linear.app/x',
      updatedAt: '2026-05-12T00:00:00Z',
    });
    expect(out).toEqual({
      id: 'FUL-7',
      uuid: 'i1',
      title: 'thing',
      description: 'body',
      status: 'todo',
      priority: 'high',
      labels: ['bug', 'web'],
      url: 'https://linear.app/x',
      updatedAt: '2026-05-12T00:00:00Z',
      isBug: true,
      assigneeId: null,
    });
  });

  it('treats null description as empty string', () => {
    const out = mapIssue({
      id: 'i',
      identifier: 'FUL-1',
      title: 't',
      description: null,
      state: { name: 'Done', type: 'completed' },
      priority: 0,
      labels: { nodes: [] },
      url: '',
      updatedAt: '',
    });
    expect(out.description).toBe('');
    expect(out.status).toBe('done');
    expect(out.priority).toBe('none');
    expect(out.isBug).toBe(false);
  });
});

describe('mapIssue — UUID preservation', () => {
  it('preserves raw.id as Issue.uuid while keeping Issue.id = identifier', () => {
    const raw: RawLinearIssue = {
      id: '11111111-2222-3333-4444-555555555555',
      identifier: 'FUL-77',
      title: 'X',
      description: null,
      state: { name: 'Todo', type: 'unstarted' },
      priority: 3,
      labels: { nodes: [] },
      url: 'https://linear.app/x/issue/FUL-77',
      updatedAt: '2026-05-01T00:00:00.000Z',
      assignee: null,
    };
    const mapped = mapIssue(raw);
    expect(mapped.id).toBe('FUL-77');
    expect(mapped.uuid).toBe('11111111-2222-3333-4444-555555555555');
  });
});

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

describe('linear-service.fetchIssueDetail', () => {
  it('maps a fetched detail issue to the internal Issue shape', async () => {
    const raw = {
      id: 'uuid-1',
      identifier: 'FUL-9',
      title: 'Fresh',
      description: 'Fresh detail text',
      state: { name: 'Todo', type: 'unstarted' },
      priority: 3,
      labels: { nodes: [{ name: 'ops' }] },
      url: 'https://linear.app/acme/issue/FUL-9',
      updatedAt: '2026-05-13T00:00:00.000Z',
    } satisfies RawLinearIssue;
    const client = {
      fetchIssueDetail: vi.fn().mockResolvedValue(raw),
    };

    const issue = await fetchIssueDetail(client, 'FUL-9');

    expect(client.fetchIssueDetail).toHaveBeenCalledWith('FUL-9');
    expect(issue).toEqual({
      id: 'FUL-9',
      uuid: 'uuid-1',
      title: 'Fresh',
      description: 'Fresh detail text',
      status: 'todo',
      priority: 'medium',
      labels: ['ops'],
      url: 'https://linear.app/acme/issue/FUL-9',
      updatedAt: '2026-05-13T00:00:00.000Z',
      isBug: false,
      assigneeId: null,
    });
  });

  it('returns null when the issue is not found', async () => {
    const client = {
      fetchIssueDetail: vi.fn().mockResolvedValue(null),
    };

    await expect(fetchIssueDetail(client, 'FUL-404')).resolves.toBeNull();
  });
});
