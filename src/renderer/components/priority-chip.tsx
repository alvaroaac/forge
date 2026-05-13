import type { Priority } from '../../shared/types';
import { IconArrowDown, IconArrowUp, IconFlame, IconMinus } from './icons';

type MetaItem = {
  label: string;
  color: string;
  Icon: React.FC<{ size?: number; stroke?: number }>;
};

const META: Partial<Record<Priority, MetaItem>> = {
  urgent: { label: 'Urgent', color: 'var(--danger)', Icon: IconFlame },
  high: { label: 'High', color: 'var(--warn)', Icon: IconArrowUp },
  medium: { label: 'Med', color: 'var(--text-2)', Icon: IconMinus },
  low: { label: 'Low', color: 'var(--text-3)', Icon: IconArrowDown },
};

type PriorityChipProps = {
  priority: Priority;
};

export function PriorityChip({ priority }: PriorityChipProps) {
  const m = META[priority];
  if (!m) return null;
  const Ico = m.Icon;

  return (
    <span className="chip" style={{ color: m.color }}>
      <Ico size={10} stroke={2} />
      <span>{m.label}</span>
    </span>
  );
}
