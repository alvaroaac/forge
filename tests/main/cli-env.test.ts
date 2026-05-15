import { delimiter } from 'node:path';
import { homedir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { buildCliEnv, buildCliPath } from '../../src/main/lib/cli-env';

describe('buildCliPath', () => {
  it('prepends common GUI-missing CLI locations and preserves the existing PATH', () => {
    const path = buildCliPath(['/custom/bin', '/usr/bin'].join(delimiter));
    const entries = path.split(delimiter);

    expect(entries.slice(0, 4)).toEqual([
      `${homedir()}/.local/bin`,
      `${homedir()}/.npm-global/bin`,
      '/Applications/Codex.app/Contents/Resources',
      '/opt/homebrew/bin',
    ]);
    expect(entries).toContain('/custom/bin');
    expect(entries.indexOf('/usr/bin')).toBe(entries.lastIndexOf('/usr/bin'));
  });
});

describe('buildCliEnv', () => {
  it('returns a copy of the environment with an augmented PATH', () => {
    const env = buildCliEnv({ PATH: '/custom/bin', FOO: 'bar' });

    expect(env.FOO).toBe('bar');
    expect(env.PATH?.split(delimiter)).toContain('/custom/bin');
    expect(env.PATH?.split(delimiter)).toContain('/Applications/Codex.app/Contents/Resources');
  });
});
