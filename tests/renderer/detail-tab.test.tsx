import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

import type { Issue } from '../../src/shared/types';
import { DetailTab } from '../../src/renderer/components/detail-tab';

const baseIssue: Issue = {
  id: 'FUL-1',
  title: 'Wire details',
  description: '',
  status: 'todo',
  priority: 'high',
  labels: ['ui'],
  url: '',
  updatedAt: '',
  isBug: false,
};

describe('DetailTab', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders heading and paragraph split when description has blank lines', () => {
    const issue: Issue = {
      ...baseIssue,
      description: 'First paragraph line one.\nFirst paragraph line two.\n\nSecond paragraph.',
    };

    const { container } = render(<DetailTab issue={issue} />);

    expect(container.querySelector('.detail-tab')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Description' })).toBeTruthy();
    expect(container.querySelectorAll('.md-body > p')).toHaveLength(2);
  });

  it('renders fallback when description is empty', () => {
    const issue: Issue = {
      ...baseIssue,
      description: '',
    };

    const { container } = render(<DetailTab issue={issue} />);

    expect(container.querySelector('.drawer-empty')).toBeTruthy();
    expect(screen.getByText('No description from Linear.')).toBeTruthy();
  });

  it('renders fallback when description is only whitespace', () => {
    const issue: Issue = {
      ...baseIssue,
      description: '   \n\t ',
    };

    const { container } = render(<DetailTab issue={issue} />);

    expect(container.querySelector('.drawer-empty')).toBeTruthy();
    expect(screen.getByText('No description from Linear.')).toBeTruthy();
  });

  it('renders single newlines inside a paragraph as spaces', () => {
    const issue: Issue = {
      ...baseIssue,
      description: 'First line.\nSecond line.\nThird line.',
    };

    const { container } = render(<DetailTab issue={issue} />);

    expect(container.querySelector('.md-body > p')?.textContent).toBe(
      'First line. Second line. Third line.',
    );
  });

  it('renders inline highlight nodes for code, references, and mentions safely', () => {
    const issue: Issue = {
      ...baseIssue,
      description: '`run()` checks §9.1 @agent',
    };

    const { container } = render(<DetailTab issue={issue} />);

    expect(container.querySelector('.md-code')?.textContent).toBe('run()');
    expect(container.querySelector('.md-ref')?.textContent).toBe('§9.1');
    expect(container.querySelector('.md-mention')?.textContent).toBe('@agent');
  });

  it('renders HTML-like text as literal text with no DOM nodes', () => {
    const issue: Issue = {
      ...baseIssue,
      description: '<img src=x onerror=alert(1)> <script>alert(1)</script>',
    };

    const { container } = render(<DetailTab issue={issue} />);

    expect(container.querySelector('.md-body > p')?.textContent).toBe(
      '<img src=x onerror=alert(1)> <script>alert(1)</script>',
    );
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('script')).toBeNull();
  });

  it('does not render a comments section', () => {
    const issue: Issue = {
      ...baseIssue,
      description: 'Only description',
    };

    const { container } = render(<DetailTab issue={issue} />);

    expect(screen.queryByRole('heading', { name: /comments/i })).toBeNull();
    expect(container.querySelector('.comments')).toBeNull();
  });
});
