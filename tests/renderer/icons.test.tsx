import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  IconClose,
  IconRefresh,
  IconSpark,
  IconSettings,
  IconChevronDown,
  IconChevronRight,
  IconExternal,
  IconPlus,
  IconCheck,
  IconEdit,
  IconTerminal,
  IconBolt,
  IconBug,
  IconFlame,
  IconArrowUp,
  IconMinus,
  IconArrowDown,
  IconBranch,
  IconFolder,
  IconCpu,
} from '../../src/renderer/components/icons';

describe('icons', () => {
  it('renders IconClose with default size and stroke', () => {
    const { container } = render(<IconClose />);
    const svg = container.querySelector('svg');

    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('width')).toBe('14');
    expect(svg?.getAttribute('height')).toBe('14');
    expect(svg?.getAttribute('stroke-width')).toBe('1.5');
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
  });

  it('renders IconClose with custom size and stroke', () => {
    const { container } = render(<IconClose size={20} stroke={2.25} />);
    const svg = container.querySelector('svg');

    expect(svg?.getAttribute('width')).toBe('20');
    expect(svg?.getAttribute('height')).toBe('20');
    expect(svg?.getAttribute('stroke-width')).toBe('2.25');
  });

  it('exports required icon components', () => {
    expect(IconRefresh).toBeTypeOf('function');
    expect(IconSpark).toBeTypeOf('function');
    expect(IconSettings).toBeTypeOf('function');
    expect(IconChevronDown).toBeTypeOf('function');
    expect(IconChevronRight).toBeTypeOf('function');
    expect(IconExternal).toBeTypeOf('function');
    expect(IconPlus).toBeTypeOf('function');
    expect(IconCheck).toBeTypeOf('function');
    expect(IconEdit).toBeTypeOf('function');
    expect(IconTerminal).toBeTypeOf('function');
    expect(IconBolt).toBeTypeOf('function');
    expect(IconBug).toBeTypeOf('function');
    expect(IconFlame).toBeTypeOf('function');
    expect(IconArrowUp).toBeTypeOf('function');
    expect(IconMinus).toBeTypeOf('function');
    expect(IconArrowDown).toBeTypeOf('function');
    expect(IconBranch).toBeTypeOf('function');
    expect(IconFolder).toBeTypeOf('function');
    expect(IconCpu).toBeTypeOf('function');
  });
});
