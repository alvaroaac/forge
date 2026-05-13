import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkAll, checkCli, checkLinearToken } from '../../src/main/services/auth-checker';
import { tryExec } from '../../src/main/lib/exec';

vi.mock('../../src/main/lib/exec', () => ({
  tryExec: vi.fn(),
}));

const tryExecMock = vi.mocked(tryExec);

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'forge-auth-'));
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('checkCli', () => {
  it('returns true when exec succeeds', async () => {
    tryExecMock.mockResolvedValueOnce({ ok: true, value: { stdout: 'v1', stderr: '' } });
    expect(await checkCli('claude --version')).toBe(true);
  });

  it('returns false when exec fails', async () => {
    tryExecMock.mockResolvedValueOnce({ ok: false, error: new Error('not found') });
    expect(await checkCli('claude --version')).toBe(false);
  });
});

describe('checkLinearToken', () => {
  it('returns false when file missing', async () => {
    expect(await checkLinearToken(join(dir, 'nope.json'))).toBe(false);
  });
  it('returns false when access_token missing in JSON', async () => {
    const p = join(dir, 'linear.json');
    writeFileSync(p, JSON.stringify({}), 'utf-8');
    expect(await checkLinearToken(p)).toBe(false);
  });
  it('returns true when access_token present', async () => {
    const p = join(dir, 'linear.json');
    writeFileSync(p, JSON.stringify({ access_token: 'abc' }), 'utf-8');
    expect(await checkLinearToken(p)).toBe(true);
  });
});

describe('checkAll', () => {
  it('composes Linear + claude + codex into AuthStatus', async () => {
    tryExecMock
      .mockResolvedValueOnce({ ok: true, value: { stdout: 'v', stderr: '' } })
      .mockResolvedValueOnce({ ok: false, error: new Error('') });
    const p = join(dir, 'linear.json');
    writeFileSync(p, JSON.stringify({ access_token: 'abc' }), 'utf-8');
    const status = await checkAll({ linearTokenPath: p });
    expect(status).toEqual({ linear: true, claudeCode: true, codex: false });
  });
});
