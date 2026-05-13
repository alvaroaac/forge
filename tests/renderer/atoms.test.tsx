import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LabelBadge } from '../../src/renderer/components/label-badge';
import { PillTab } from '../../src/renderer/components/pill-tab';
import { PriorityChip } from '../../src/renderer/components/priority-chip';
import { StatusDot } from '../../src/renderer/components/status-dot';

describe('atoms', () => {
  it('StatusDot renders aria-label of state', () => {
    const { getByLabelText } = render(<StatusDot state="connected" />);
    expect(getByLabelText('connected')).toBeTruthy();
  });

  it('PriorityChip renders label for priority', () => {
    const { getByText } = render(<PriorityChip priority="high" />);
    expect(getByText('High')).toBeTruthy();
  });

  it('PriorityChip returns null for "none"', () => {
    const { container } = render(<PriorityChip priority="none" />);
    expect(container.firstChild).toBeNull();
  });

  it('LabelBadge renders the label text', () => {
    const { getByText } = render(<LabelBadge label="auth" />);
    expect(getByText('auth')).toBeTruthy();
  });

  it('PillTab toggles active class and shows count', () => {
    const { getByText, container } = render(
      <PillTab active count={3} onClick={() => {}}>
        Todo
      </PillTab>,
    );

    expect(getByText('Todo')).toBeTruthy();
    expect(getByText('3')).toBeTruthy();
    expect(container.querySelector('.tab-active')).toBeTruthy();
  });
});
