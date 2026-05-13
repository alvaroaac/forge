import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

import { MarkdownSection } from '../../src/renderer/components/markdown-section';
import { highlightInline, splitSections, type Section } from '../../src/renderer/lib/markdown';

const sectionFixture = (h: string, body: string) => ({ h, body });

describe('highlightInline', () => {
  it('wraps code spans, section refs, and mentions', () => {
    const input = '`run()` is ready for §3.2 @alice';
    const output = highlightInline(input);

    expect(output).toBe(
      '<code class="md-code">run()</code> is ready for <span class="md-ref">§3.2</span> <span class="md-mention">@alice</span>',
    );
  });
});

describe('splitSections', () => {
  it('splits markdown by heading lines', () => {
    const md = '## Install\nRun setup first.\n## Verify\nRun tests and ship';
    const sections = splitSections(md);

    expect(sections).toEqual<Section[]>([
      { h: 'Install', body: 'Run setup first.' },
      { h: 'Verify', body: 'Run tests and ship' },
    ]);
  });

  it('preserves content before first heading as a preface section', () => {
    const md =
      'Top note\n\nbefore headings.\n## Install\nRun setup first.\n## Verify\nRun tests and ship';
    const sections = splitSections(md);

    expect(sections).toEqual<Section[]>([
      { h: '', body: 'Top note\n\nbefore headings.' },
      { h: 'Install', body: 'Run setup first.' },
      { h: 'Verify', body: 'Run tests and ship' },
    ]);
  });

  it('does not preserve whitespace-only content before first heading', () => {
    const md = '\n\n## A\nbody';
    const sections = splitSections(md);

    expect(sections).toEqual<Section[]>([{ h: 'A', body: 'body' }]);
  });

  it('returns one section when no heading is present', () => {
    const md = 'A plain paragraph with no heading';
    const sections = splitSections(md);

    expect(sections).toEqual<Section[]>([{ h: '', body: md }]);
  });

  it('normalizes CRLF inputs before splitting', () => {
    const md =
      'Top note\r\n\r\n## Install\r\nRun setup first.\r\n- then verify\r\n## Verify\r\nRun tests and ship';
    const sections = splitSections(md);

    expect(sections).toEqual<Section[]>([
      { h: '', body: 'Top note' },
      { h: 'Install', body: 'Run setup first.\n- then verify' },
      { h: 'Verify', body: 'Run tests and ship' },
    ]);
  });
});

describe('MarkdownSection', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders heading, paragraphs, list lines, and skips blank lines', () => {
    const section: Section = sectionFixture(
      'Scope',
      'Do this first.\n\n• one\n- two\n* three\n1. step one\n2. step two\n',
    );
    const { container } = render(<MarkdownSection h={section.h} body={section.body} />);

    expect(container.querySelector('.md-section')).toBeTruthy();
    expect(container.querySelector('.md-h')?.textContent).toBe('Scope');
    expect(container.querySelectorAll('.md-body > p')).toHaveLength(1);
    expect(container.querySelectorAll('ul.md-list')).toHaveLength(1);
    expect(container.querySelectorAll('ol.md-list')).toHaveLength(1);
    expect(container.querySelectorAll('li.md-li')).toHaveLength(5);

    expect(container.querySelectorAll('li.md-li .md-li-mark')[0].textContent).toBe('•');
    expect(container.querySelectorAll('li.md-li .md-li-mark')[3].textContent).toBe('1.');
    expect(container.querySelectorAll('li.md-li .md-li-mark')[4].textContent).toBe('2.');

    expect(screen.getAllByRole('list')).toHaveLength(2);
    expect(screen.getAllByRole('listitem')).toHaveLength(5);

    for (const item of container.querySelectorAll('li.md-li')) {
      expect(item.parentElement?.tagName.toLowerCase()).toMatch(/^(ul|ol)$/);
      expect(item.parentElement?.getAttribute('role')).toBeNull();
    }
  });

  it('highlights inline tokens as React nodes', () => {
    const section: Section = sectionFixture(
      '',
      '`boot` before @ops in §9.1\n1. Use `cargo` and mention @alice',
    );
    const { container } = render(<MarkdownSection h={section.h} body={section.body} />);

    const heading = container.querySelector('.md-h');
    expect(heading).toBeNull();
    const codeSpans = container.querySelectorAll('.md-code');
    expect(codeSpans[0].textContent).toBe('boot');
    expect(codeSpans[1].textContent).toBe('cargo');
    expect(container.querySelectorAll('.md-ref')).toHaveLength(1);
    expect(container.querySelectorAll('.md-mention')).toHaveLength(2);
  });

  it('renders malicious HTML-like content as literal text', () => {
    const section: Section = sectionFixture('', '<img src=x onerror=alert(1)>');
    const { container } = render(<MarkdownSection h={section.h} body={section.body} />);

    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('.md-body')?.textContent).toBe('<img src=x onerror=alert(1)>');
  });
});
