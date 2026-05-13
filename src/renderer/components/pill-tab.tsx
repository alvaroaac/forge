import type { ReactNode } from 'react';

type PillTabProps = {
  active: boolean;
  count: number;
  children: ReactNode;
  onClick: () => void;
};

export function PillTab({ active, count, children, onClick }: PillTabProps) {
  return (
    <button type="button" className={`tab ${active ? 'tab-active' : ''}`} onClick={onClick}>
      <span>{children}</span>
      <span className="tab-count">{count}</span>
    </button>
  );
}
