type State = 'connected' | 'disconnected' | 'running' | 'review' | 'warning' | 'error' | string;

const COLOR: Record<string, string> = {
  connected: 'var(--ok)',
  running: 'var(--ok)',
  review: 'var(--warn)',
  warning: 'var(--warn)',
  error: 'var(--danger)',
  disconnected: 'var(--danger)',
};

type StatusDotProps = {
  state: State;
  size?: number;
};

export function StatusDot({ state, size = 6 }: StatusDotProps) {
  const color = COLOR[state] ?? 'var(--text-3)';

  return (
    <span
      aria-label={state}
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        borderRadius: 999,
        background: color,
        boxShadow: `0 0 0 2px ${color}22`,
        flex: 'none',
      }}
    />
  );
}
