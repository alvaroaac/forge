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
  { key: 'computron', label: 'Computron' },
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
          <svg className="brand-mark" viewBox="0 0 64 64" fill="none" aria-hidden="true">
            <defs>
              <mask id="brand-tile-f-cut">
                <rect width="64" height="64" fill="white" />
                <rect x="14" y="14" width="8" height="36" fill="black" />
                <rect x="22" y="14" width="28" height="8" fill="black" />
                <rect x="22" y="28" width="18" height="8" fill="black" />
              </mask>
            </defs>
            <rect
              width="64"
              height="64"
              rx="14"
              fill="currentColor"
              mask="url(#brand-tile-f-cut)"
            />
          </svg>
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
