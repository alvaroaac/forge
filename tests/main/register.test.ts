import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { IpcMain } from 'electron';
import { registerAll } from '../../src/main/ipc/register';
import type { SpecGenerateDeps } from '../../src/main/ipc/spec';
import type { BriefGenerateDeps } from '../../src/main/ipc/brief';
import type { RawLinearComment } from '../../src/main/services/comment-fetcher';

const mocks = vi.hoisted(() => ({
  registerAuthHandlers: vi.fn(),
  registerCommentsFetchHandler: vi.fn(),
  registerCommentsGenerateSummaryHandler: vi.fn(),
  registerConfigHandlers: vi.fn(),
  registerLinearHandlers: vi.fn(),
  registerSpecGenerateHandler: vi.fn(),
  registerSpecGetHandler: vi.fn(),
  registerSpecLaunchReviewHandler: vi.fn(),
  registerSpecWriteHandler: vi.fn(),
  registerBriefGenerateHandler: vi.fn(),
  registerBriefGetHandler: vi.fn(),
  registerBriefWriteHandler: vi.fn(),
  streamClaude: vi.fn().mockResolvedValue('curated comments'),
}));

vi.mock('../../src/main/ipc/auth', () => ({
  registerAuthHandlers: mocks.registerAuthHandlers,
}));

vi.mock('../../src/main/ipc/comments', () => ({
  registerCommentsFetchHandler: mocks.registerCommentsFetchHandler,
  registerCommentsGenerateSummaryHandler: mocks.registerCommentsGenerateSummaryHandler,
}));

vi.mock('../../src/main/ipc/config', () => ({
  registerConfigHandlers: mocks.registerConfigHandlers,
}));

vi.mock('../../src/main/ipc/linear', () => ({
  registerLinearHandlers: mocks.registerLinearHandlers,
}));

vi.mock('../../src/main/ipc/spec', () => ({
  registerSpecGenerateHandler: mocks.registerSpecGenerateHandler,
  registerSpecGetHandler: mocks.registerSpecGetHandler,
  registerSpecLaunchReviewHandler: mocks.registerSpecLaunchReviewHandler,
  registerSpecWriteHandler: mocks.registerSpecWriteHandler,
}));

vi.mock('../../src/main/ipc/brief', () => ({
  registerBriefGenerateHandler: mocks.registerBriefGenerateHandler,
  registerBriefGetHandler: mocks.registerBriefGetHandler,
  registerBriefWriteHandler: mocks.registerBriefWriteHandler,
}));

vi.mock('../../src/main/services/config-store', () => ({
  createConfigStore: () => ({
    get: async () => ({
      linearTokenPath: '',
      linearTeamKey: 'FUL',
      repoPath: '',
      computronRepoPath: '',
      claudeModel: 'claude-sonnet-4-6',
    }),
    set: async () => undefined,
  }),
}));

vi.mock('../../src/main/services/issues-cache', () => ({
  createIssuesCache: () => ({
    get: async () => [],
    set: async () => undefined,
  }),
}));

vi.mock('../../src/main/services/spec-generator', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/main/services/spec-generator')>();
  return {
    ...actual,
    streamClaude: mocks.streamClaude,
  };
});

type LinearClientDouble = {
  getCurrentUser: () => Promise<{ id: string; name: string; email: string }>;
  checkAuth: () => Promise<boolean>;
  fetchAssignedIssues: () => Promise<[]>;
  fetchIssueDetail: () => Promise<null>;
  fetchTeamTriage: () => Promise<[]>;
  fetchIssueComments: (issueId: string) => Promise<RawLinearComment[]>;
};

type RegisterTestGlobal = typeof globalThis & {
  __forgeRegisterLinearClient?: LinearClientDouble;
};

function makeAppRoot(): string {
  const appRoot = mkdtempSync(join(tmpdir(), 'forge-register-'));
  mkdirSync(join(appRoot, '.agents', 'skills', 'linear', 'reference'), { recursive: true });
  writeFileSync(
    join(appRoot, '.agents', 'skills', 'linear', 'reference', 'linear.mjs'),
    'export function createLinearClient() { return globalThis.__forgeRegisterLinearClient; }\n',
    'utf-8',
  );
  mkdirSync(join(appRoot, 'docs', 'templates'), { recursive: true });
  writeFileSync(join(appRoot, 'docs', 'templates', 'spec-template.md'), '# template', 'utf-8');
  return appRoot;
}

function makeLinearClient(fetchIssueComments: LinearClientDouble['fetchIssueComments']) {
  return {
    getCurrentUser: async () => ({ id: 'viewer-1', name: 'Viewer', email: 'v@example.com' }),
    checkAuth: async () => true,
    fetchAssignedIssues: async () => [],
    fetchIssueDetail: async () => null,
    fetchTeamTriage: async () => [],
    fetchIssueComments,
  } satisfies LinearClientDouble;
}

async function registerWithClient(client: LinearClientDouble): Promise<void> {
  (globalThis as RegisterTestGlobal).__forgeRegisterLinearClient = client;
  await registerAll({} as IpcMain, makeAppRoot());
}

describe('registerAll comment context wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete (globalThis as RegisterTestGlobal).__forgeRegisterLinearClient;
  });

  it("wires fetchAndFilterComments through to the client's fetchIssueComments using issue UUID", async () => {
    const rawComment: RawLinearComment = {
      id: 'comment-1',
      body: 'human context',
      createdAt: '2026-05-20T00:00:00.000Z',
      user: { id: 'user-1', name: 'Alice' },
      botActor: null,
    };
    const fetchIssueComments = vi.fn().mockResolvedValue([rawComment]);
    await registerWithClient(makeLinearClient(fetchIssueComments));

    const specDeps = mocks.registerSpecGenerateHandler.mock.calls[0]?.[1] as SpecGenerateDeps;
    const briefDeps = mocks.registerBriefGenerateHandler.mock.calls[0]?.[1] as BriefGenerateDeps;
    const commentsDeps = mocks.registerCommentsGenerateSummaryHandler.mock.calls[0]?.[1] as {
      fetchAndFilterComments: SpecGenerateDeps['fetchAndFilterComments'];
      triageComments: SpecGenerateDeps['triageComments'];
    };
    const commentsFetchDeps = mocks.registerCommentsFetchHandler.mock.calls[0]?.[1] as {
      fetchAndFilterComments: SpecGenerateDeps['fetchAndFilterComments'];
    };

    await expect(specDeps.fetchAndFilterComments('uuid-abc')).resolves.toEqual([
      {
        id: 'comment-1',
        body: 'human context',
        createdAt: '2026-05-20T00:00:00.000Z',
        authorName: 'Alice',
        isBot: false,
      },
    ]);
    await briefDeps.fetchAndFilterComments('uuid-def');
    await commentsDeps.fetchAndFilterComments('uuid-ghi');
    await commentsFetchDeps.fetchAndFilterComments('uuid-jkl');

    expect(fetchIssueComments).toHaveBeenNthCalledWith(1, 'uuid-abc');
    expect(fetchIssueComments).toHaveBeenNthCalledWith(2, 'uuid-def');
    expect(fetchIssueComments).toHaveBeenNthCalledWith(3, 'uuid-ghi');
    expect(fetchIssueComments).toHaveBeenNthCalledWith(4, 'uuid-jkl');
    await expect(
      specDeps.triageComments({
        issueTitle: 'Title',
        issueDescription: 'Description',
        comments: [],
      }),
    ).resolves.toBe('');
    await expect(
      briefDeps.triageComments({
        issueTitle: 'Title',
        issueDescription: 'Description',
        comments: [],
      }),
    ).resolves.toBe('');
    await expect(
      commentsDeps.triageComments({
        issueTitle: 'Title',
        issueDescription: 'Description',
        comments: [],
      }),
    ).resolves.toBe('');
  });
});
