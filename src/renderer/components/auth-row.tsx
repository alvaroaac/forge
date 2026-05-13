import { StatusDot } from './status-dot';

type AuthRowProps = {
  name: string;
  state: 'connected' | 'disconnected';
};

export function AuthRow({ name, state }: AuthRowProps) {
  return (
    <div className="auth-row">
      <StatusDot state={state} />
      <span className="auth-name">{name}</span>
      <span className="auth-detail mono" />
      <span
        className="auth-state mono"
        style={{ color: state === 'connected' ? 'var(--ok)' : 'var(--danger)' }}
      >
        {state}
      </span>
    </div>
  );
}
