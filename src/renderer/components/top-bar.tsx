import type { AuthStatus } from '../../shared/types';
import { IconSettings } from './icons';
import { StatusDot } from './status-dot';

type AuthSource = {
  key: keyof AuthStatus;
  label: string;
};

const AUTH_SOURCES: AuthSource[] = [
  { key: 'claudeCode', label: 'Claude Code' },
  { key: 'codex', label: 'Codex CLI' },
  { key: 'linear', label: 'Linear' },
];

type TopBarProps = {
  auth: AuthStatus;
  teamKey: string;
  lastSync: string;
};

export function TopBar({ auth, teamKey, lastSync }: TopBarProps) {
  return (
    <div className="topbar">
      <div className="topbar-left">
        <span className="brand">
          <span className="brand-mark" />
          FORGE
        </span>
        <span className="brand-sub mono dim">v0.1 · {teamKey} team</span>
      </div>

      <div className="topbar-right">
        <div className="auth-strip">
          {AUTH_SOURCES.map(({ key, label }) => (
            <span key={key} className="auth-pill">
              <StatusDot state={auth[key] ? 'connected' : 'disconnected'} />
              <span className="auth-pill-name">{label}</span>
            </span>
          ))}
        </div>
        <span className="topbar-sep" />
        <span className="mono dim sync-stamp">
          last sync <span style={{ color: 'var(--text-1)' }}>{lastSync}</span>
        </span>
        <button type="button" className="icon-btn" aria-label="Settings">
          <IconSettings size={14} />
        </button>
      </div>
    </div>
  );
}
