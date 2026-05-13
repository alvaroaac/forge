import type { AuthStatus } from '../../shared/types';
import { AuthRow } from './auth-row';

const AUTH_ROWS: Array<{ key: keyof AuthStatus; name: string }> = [
  { key: 'claudeCode', name: 'Claude Code' },
  { key: 'codex', name: 'Codex CLI' },
  { key: 'linear', name: 'Linear' },
];

type RightPanelProps = {
  auth: AuthStatus;
};

export function RightPanel({ auth }: RightPanelProps) {
  return (
    <div className="panel-right">
      <section className="rp-section">
        <h3 className="rp-h">Connections</h3>
        <ul className="auth-list">
          {AUTH_ROWS.map((row) => (
            <AuthRow
              key={row.key}
              name={row.name}
              state={auth[row.key] ? 'connected' : 'disconnected'}
            />
          ))}
        </ul>
      </section>

      <section className="rp-section">
        <h3 className="rp-h">Recent activity</h3>
        <div className="activity-list">
          <div className="empty">No activity yet.</div>
        </div>
      </section>

      <section className="rp-section rp-section-grow">
        <div className="rp-section-head">
          <h3 className="rp-h">
            Running agents <span className="mono dim">(0)</span>
          </h3>
        </div>
        <div className="empty empty-agents">
          <div className="mono dim" style={{ marginBottom: 6 }}>
            $ forge agent ls
          </div>
          Phase 1 — agent spawning ships in Phase 2.
        </div>
      </section>
    </div>
  );
}
