import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';

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
    render(<RightPanel auth={auth} />);

    expect(screen.getByRole('heading', { name: /^Connections$/i })).toBeTruthy();
    const connectionsSection = screen
      .getByRole('heading', { name: /^Connections$/i })
      .closest('section');
    expect(connectionsSection).not.toBeNull();

    const { getByRole, getAllByRole } = within(connectionsSection as HTMLElement);
    const rows = getAllByRole('listitem');
    expect(rows).toHaveLength(3);

    expect(rows[0].textContent).toContain('Claude Code');
    expect(rows[1].textContent).toContain('Codex CLI');
    expect(rows[2].textContent).toContain('Linear');
    expect(getByRole('list')).toBeTruthy();
  });

  it('derives connected/disconnected states from booleans', () => {
    render(<RightPanel auth={auth} />);

    expect(screen.getAllByLabelText('connected')).toHaveLength(2);
    expect(screen.getAllByLabelText('disconnected')).toHaveLength(1);
  });

  it('renders activity placeholder and no activity rows for phase 1', () => {
    render(<RightPanel auth={auth} />);

    expect(screen.getByRole('heading', { name: /^Recent activity$/i })).toBeTruthy();
    const activitySection = screen
      .getByRole('heading', { name: /^Recent activity$/i })
      .closest('section');
    const { queryByRole, getByText } = within(activitySection as HTMLElement);

    expect(getByText('No activity yet.')).toBeTruthy();
    expect(queryByRole('listitem')).toBeNull();
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
  it('renders name, empty detail placeholder, and status state', () => {
    render(
      <ul>
        <AuthRow name="Claude Code" state="connected" />
      </ul>,
    );

    const row = screen.getByRole('listitem');
    const detail = row.querySelector('.auth-detail');

    expect(row.textContent).toContain('Claude Code');
    expect(screen.getByRole('img', { name: 'connected' })).toBeTruthy();
    expect(row.textContent).toContain('connected');
    expect(detail).not.toBeNull();
    expect(detail?.textContent).toBe('');
  });
});

describe('ActivityRow', () => {
  it('renders id, text, and timestamp in expected spots', () => {
    render(
      <ul>
        <ActivityRow id="FUL-1" text="Generated spec" ts="2m ago" />
      </ul>,
    );

    const row = screen.getByRole('listitem');

    expect(row.textContent).toContain('FUL-1');
    expect(row.textContent).toContain('Generated spec');
    expect(row.textContent).toContain('2m ago');
  });
});
