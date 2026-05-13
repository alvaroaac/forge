import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import type { AuthStatus } from '../../src/shared/types';
import { TopBar } from '../../src/renderer/components/top-bar';

const auth: AuthStatus = {
  claudeCode: true,
  codex: false,
  linear: true,
};

describe('TopBar', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders brand, team, and last sync text', () => {
    const { getByText } = render(<TopBar auth={auth} teamKey="ENG" lastSync="just now" />);

    expect(getByText('FORGE')).toBeTruthy();
    expect(getByText('v0.1 · ENG team')).toBeTruthy();
    expect(getByText(/last sync/i)).toBeTruthy();
    expect(getByText('just now')).toBeTruthy();
  });

  it('renders auth pills in fixed order with dot states derived from booleans', () => {
    const { container } = render(<TopBar auth={auth} teamKey="ENG" lastSync="just now" />);

    const pills = container.querySelectorAll('.auth-pill');
    const names = Array.from(pills).map(
      (pill) => pill.querySelector('.auth-pill-name')?.textContent ?? '',
    );
    expect(names).toEqual(['Claude Code', 'Codex CLI', 'Linear']);

    const connectedDots = screen.getAllByLabelText('connected');
    const disconnectedDots = screen.getAllByLabelText('disconnected');

    expect(connectedDots).toHaveLength(2);
    expect(disconnectedDots).toHaveLength(1);

    expect(
      pills[0]
        ?.querySelector('[aria-label="connected"], [aria-label="disconnected"]')
        ?.getAttribute('aria-label'),
    ).toBe('connected');
    expect(
      pills[1]
        ?.querySelector('[aria-label="connected"], [aria-label="disconnected"]')
        ?.getAttribute('aria-label'),
    ).toBe('disconnected');
    expect(
      pills[2]
        ?.querySelector('[aria-label="connected"], [aria-label="disconnected"]')
        ?.getAttribute('aria-label'),
    ).toBe('connected');
  });

  it('renders a real settings button with accessible name and does not throw on click', () => {
    render(<TopBar auth={auth} teamKey="ENG" lastSync="just now" />);

    const settingsButton = screen.getByRole('button', { name: 'Settings' });
    expect(settingsButton.getAttribute('type')).toBe('button');
    expect(() => {
      fireEvent.click(settingsButton);
    }).not.toThrow();
  });
});
