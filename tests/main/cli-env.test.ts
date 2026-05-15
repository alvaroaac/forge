import { delimiter } from 'node:path';
import { homedir } from 'node:os';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildCliEnv, buildCliPath, discoverNvmBinPaths } from '../../src/main/lib/cli-env';

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.map((root) => rm(root, { recursive: true, force: true })));
  tempRoots.length = 0;
});

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

describe('discoverNvmBinPaths', () => {
  it('returns nvm node bin paths in newest-version order', async () => {
    const home = await mkdtemp(join(tmpdir(), 'forge-cli-env-home-'));
    tempRoots.push(home);
    await mkdir(join(home, '.nvm', 'versions', 'node', 'v20.1.0', 'bin'), { recursive: true });
    await mkdir(join(home, '.nvm', 'versions', 'node', 'v22.15.0', 'bin'), { recursive: true });
    await mkdir(join(home, '.nvm', 'versions', 'node', 'v18.20.8', 'bin'), { recursive: true });

    expect(discoverNvmBinPaths(home)).toEqual([
      join(home, '.nvm', 'versions', 'node', 'v22.15.0', 'bin'),
      join(home, '.nvm', 'versions', 'node', 'v20.1.0', 'bin'),
      join(home, '.nvm', 'versions', 'node', 'v18.20.8', 'bin'),
    ]);
  });

  it('returns an empty list when nvm is not installed', async () => {
    const home = await mkdtemp(join(tmpdir(), 'forge-cli-env-home-'));
    tempRoots.push(home);

    expect(discoverNvmBinPaths(home)).toEqual([]);
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
