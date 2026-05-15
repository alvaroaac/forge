import { describe, it, expect, afterEach, vi } from 'vitest';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { checkAll, checkCli, checkLinearApi, type LinearAuthClient } from '../../src/main/services/auth-checker';
import { tryExec } from '../../src/main/lib/exec';

vi.mock('../../src/main/lib/exec', () => ({
  tryExec: vi.fn(),
}));

const tryExecMock = vi.mocked(tryExec);

afterEach(() => {
  vi.clearAllMocks();
});

function createLinearClient(result: boolean): LinearAuthClient {
  return {
    checkAuth: vi.fn().mockResolvedValue(result),
  };
}

describe('checkCli', () => {
  it('returns true when exec succeeds', async () => {
    tryExecMock.mockResolvedValueOnce({ ok: true, value: { stdout: 'v1', stderr: '' } });
    expect(await checkCli('claude --version')).toBe(true);
  });

  it('returns false when exec fails', async () => {
    tryExecMock.mockResolvedValueOnce({ ok: false, error: new Error('not found') });
    expect(await checkCli('claude --version')).toBe(false);
  });

  it('returns false when exec throws', async () => {
    tryExecMock.mockRejectedValueOnce(new Error('boom'));
    expect(await checkCli('claude --version')).toBe(false);
  });
});

describe('checkLinearApi', () => {
  it('delegates Linear health to the canonical Linear skill client with the configured token path', async () => {
    const client = createLinearClient(true);

    expect(await checkLinearApi(client, '/tmp/linear.json')).toBe(true);
    expect(client.checkAuth).toHaveBeenCalledWith('/tmp/linear.json');
  });

  it('returns false when the Linear skill client rejects', async () => {
    const client: LinearAuthClient = {
      checkAuth: vi.fn().mockRejectedValue(new Error('AUTHENTICATION_ERROR')),
    };

    expect(await checkLinearApi(client, '/tmp/linear.json')).toBe(false);
  });
});

describe('checkAll', () => {
  it('uses auth-status commands and real Linear API health for AuthStatus', async () => {
    const linearClient = createLinearClient(true);
    tryExecMock
      .mockResolvedValueOnce({ ok: true, value: { stdout: 'v', stderr: '' } })
      .mockResolvedValueOnce({ ok: false, error: new Error('') });

    const status = await checkAll({
      linearTokenPath: '/tmp/linear.json',
      linearClient,
      computronRepoPath: '',
    });

    expect(linearClient.checkAuth).toHaveBeenCalledWith('/tmp/linear.json');
    expect(tryExecMock).toHaveBeenNthCalledWith(1, 'claude auth status');
    expect(tryExecMock).toHaveBeenNthCalledWith(2, 'codex login status');
    expect(tryExecMock).not.toHaveBeenCalledWith('claude --version');
    expect(tryExecMock).not.toHaveBeenCalledWith('codex --version');
    expect(status).toEqual({ linear: true, claudeCode: true, codex: false, computron: false });
  });

  it('returns linear false when token exists but viewer call fails', async () => {
    const linearClient: LinearAuthClient = {
      checkAuth: vi.fn().mockRejectedValue(new Error('timeout')),
    };
    tryExecMock
      .mockResolvedValueOnce({ ok: true, value: { stdout: '', stderr: '' } })
      .mockResolvedValueOnce({ ok: true, value: { stdout: '', stderr: '' } });

    const status = await checkAll({
      linearTokenPath: '/tmp/linear.json',
      linearClient,
      computronRepoPath: '',
    });
    expect(status.linear).toBe(false);
  });

  it('returns computron true when the configured path exists and contains a .git directory', async () => {
    const linearClient = createLinearClient(true);
    const tempRoot = await mkdtemp(join(tmpdir(), 'auth-checker-computron-'));
    const gitRoot = join(tempRoot, '.git');
    await mkdir(gitRoot);
    tryExecMock
      .mockResolvedValueOnce({ ok: true, value: { stdout: 'v', stderr: '' } })
      .mockResolvedValueOnce({ ok: true, value: { stdout: '', stderr: '' } });

    const status = await checkAll({
      linearTokenPath: '/tmp/linear.json',
      linearClient,
      computronRepoPath: tempRoot,
    });

    expect(status.computron).toBe(true);
    expect(status.linear).toBe(true);
    expect(status.claudeCode).toBe(true);
    expect(status.codex).toBe(true);
    await rm(tempRoot, { recursive: true, force: true });
  });
});
