import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import type { Issue } from '../../src/shared/types';
import { IssueDrawerShell } from '../../src/renderer/components/issue-drawer-shell';

const issue: Issue = {
  id: 'FUL-7',
  uuid: 'uuid-test-fixture',
  title: 'Build the drawer shell',
  description: 'Linear description',
  status: 'todo',
  priority: 'high',
  labels: ['web', 'ux'],
  url: 'https://linear.app/acme/issue/FUL-7',
  updatedAt: '2026-05-13T12:00:00.000Z',
  isBug: false,
  assigneeId: null,
};

describe('IssueDrawerShell', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders a closed shell without header content when issue is null', () => {
    const { container } = render(
      <IssueDrawerShell issue={null} onClose={vi.fn()}>
        body
      </IssueDrawerShell>,
    );

    expect(container.querySelector('.drawer-scrim')).toBeTruthy();
    expect(container.querySelector('.drawer-scrim-open')).toBeNull();
    expect(container.querySelector('.drawer')).toBeTruthy();
    expect(container.querySelector('.drawer-open')).toBeNull();
    expect(container.querySelector('.drawer-id')).toBeNull();
    expect(container.querySelector('.drawer-body')).toBeNull();
  });

  it('can suppress the closed shell for drawers that unmount when closed', () => {
    const { container } = render(
      <IssueDrawerShell issue={null} onClose={vi.fn()} renderClosedShell={false}>
        body
      </IssueDrawerShell>,
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders issue metadata, tabs, Linear link, and children when open', () => {
    const setTab = vi.fn();

    render(
      <IssueDrawerShell
        issue={issue}
        onClose={vi.fn()}
        tabs={[
          { key: 'detail', label: 'Detail', isActive: false, onClick: () => setTab('detail') },
          { key: 'spec', label: 'Spec', isActive: true, onClick: () => setTab('spec') },
        ]}
      >
        <div>drawer body</div>
      </IssueDrawerShell>,
    );

    expect(screen.getByText('FUL-7')).toBeTruthy();
    expect(screen.getByText('Build the drawer shell')).toBeTruthy();
    expect(screen.getByText('High')).toBeTruthy();
    expect(screen.getByText('web')).toBeTruthy();
    expect(screen.getByText('ux')).toBeTruthy();
    expect(screen.getByText('drawer body')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Spec' }).className).toContain('drawer-tab-active');

    const anchor = screen.getByRole('link', { name: /Linear/i });
    expect(anchor.getAttribute('href')).toBe(issue.url);
    expect(anchor.getAttribute('target')).toBe('_blank');
    expect(anchor.getAttribute('rel')).toContain('noreferrer');

    fireEvent.click(screen.getByRole('button', { name: 'Detail' }));
    expect(setTab).toHaveBeenCalledWith('detail');
  });

  it('closes from the close button, scrim, and optional Escape handler', () => {
    const onClose = vi.fn();
    const { container } = render(
      <IssueDrawerShell
        issue={issue}
        onClose={onClose}
        closeTitle="Close (Esc)"
        closeOnEscape={true}
      >
        body
      </IssueDrawerShell>,
    );

    fireEvent.click(screen.getByRole('button', { name: /Close/i }));
    fireEvent.click(container.querySelector('.drawer-scrim-open')!);
    fireEvent.keyDown(window, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(3);
  });
});
