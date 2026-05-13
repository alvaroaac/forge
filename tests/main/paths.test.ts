import { describe, it, expect, vi } from 'vitest';
import { homedir } from 'node:os';
import { expandHome, forgeDir, configPath, issuesCachePath } from '../../src/main/lib/paths';

describe('paths', () => {
  it('expands ~ to homedir', () => {
    expect(expandHome('~/foo')).toBe(`${homedir()}/foo`);
    expect(expandHome('/abs/path')).toBe('/abs/path');
  });
  it('forgeDir = ~/.forge', () => {
    expect(forgeDir()).toBe(`${homedir()}/.forge`);
  });
  it('configPath = ~/.forge/config.json', () => {
    expect(configPath()).toBe(`${homedir()}/.forge/config.json`);
  });
  it('issuesCachePath = ~/.forge/issues.json', () => {
    expect(issuesCachePath()).toBe(`${homedir()}/.forge/issues.json`);
  });
});
