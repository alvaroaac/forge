import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkLinearToken } from '../../src/main/services/auth-checker';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'forge-auth-'));
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
