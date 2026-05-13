import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

import type { AuthStatus } from '../../src/shared/types';
import { AuthRow } from '../../src/renderer/components/auth-row';
import { ActivityRow } from '../../src/renderer/components/activity-row';
import { RightPanel } from '../../src/renderer/components/right-panel';

const auth: AuthStatus = {
  claudeCode: true,
  codex: false,
  linear: true,
};

afterEach(() => {
  cleanup();
});

describe('RightPanel', () => {
  it('renders connections section with rows in expected order', () => {
    const { container } = render(<RightPanel auth={auth} />);

    expect(screen.getByRole('heading', { name: /^Connections$/i })).toBeTruthy();

    const rows = container.querySelectorAll('.auth-row');
    expect(rows).toHaveLength(3);

    const labels = Array.from(rows).map((row) => row.querySelector('.auth-name')?.textContent);
    expect(labels).toEqual(['Claude Code', 'Codex CLI', 'Linear']);
  });

  it('derives connected/disconnected states from booleans', () => {
    render(<RightPanel auth={auth} />);

    expect(screen.getAllByLabelText('connected')).toHaveLength(2);
    expect(screen.getAllByLabelText('disconnected')).toHaveLength(1);
  });

  it('renders activity placeholder and no activity rows for phase 1', () => {
    const { container } = render(<RightPanel auth={auth} />);

    expect(screen.getByRole('heading', { name: /^Recent activity$/i })).toBeTruthy();
    const section = screen.getByText('No activity yet.');
    expect(section).toBeTruthy();
    expect(container.querySelector('.activity-row')).toBeNull();
  });

  it('renders running agents empty state with phase 1 message', () => {
    render(<RightPanel auth={auth} />);

    expect(screen.getByRole('heading', { name: /^Running agents/i })).toBeTruthy();
    expect(screen.getByText('$ forge agent ls')).toBeTruthy();
    expect(screen.getByText('Phase 1 — agent spawning ships in Phase 2.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /new agent/i })).toBeNull();
    expect(screen.queryByText('Logs')).toBeNull();
    expect(screen.queryByText('Manage')).toBeNull();
  });
});

describe('AuthRow', () => {
  it('renders name, empty detail placeholder, and status color', () => {
    const { container } = render(<AuthRow name="Claude Code" state="connected" />);
    const name = container.querySelector('.auth-name');
    const detail = container.querySelector('.auth-detail');
    const state = container.querySelector('.auth-state');

    expect(name?.textContent).toBe('Claude Code');
    expect(detail).not.toBeNull();
    expect(detail?.textContent).toBe('');
    expect(state?.getAttribute('style')).toBeTruthy();
    expect(state?.getAttribute('style')).toContain('var(--ok)');
  });
});

describe('ActivityRow', () => {
  it('renders id, text, and timestamp in expected spots', () => {
    const { container } = render(<ActivityRow id="FUL-1" text="Generated spec" ts="2m ago" />);

    expect(container.querySelector('.activity-id')?.textContent).toBe('FUL-1');
    expect(container.querySelector('.activity-text')?.textContent).toBe('Generated spec');
    expect(container.querySelector('.activity-ts')?.textContent).toBe('2m ago');
  });
});
