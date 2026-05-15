import { describe, it, expect } from 'vitest';
import { tryExec, tryExecFile } from '../../src/main/lib/exec';

describe('tryExec', () => {
  it('resolves ok=true with stdout for a passing command', async () => {
    const r = await tryExec('node -e "console.log(\'hi\')"');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.stdout).toContain('hi');
  });
  it('resolves ok=false for a failing command', async () => {
    const r = await tryExec('this-command-does-not-exist-xyz123');
    expect(r.ok).toBe(false);
  });
});

describe('tryExecFile', () => {
  it('resolves ok=true with stdout for a passing file and args', async () => {
    const r = await tryExecFile('node', ['-e', "console.log('hi')"]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.stdout).toContain('hi');
  });

  it('resolves ok=false for a missing executable', async () => {
    const r = await tryExecFile('this-command-does-not-exist-xyz123');
    expect(r.ok).toBe(false);
  });
});
