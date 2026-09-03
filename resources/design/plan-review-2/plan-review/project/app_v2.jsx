/* global React, ReactDOM, MermaidBlock */
const { useState, useEffect } = React;

// ───── TWEAK DEFAULTS (persisted) ─────
const TWEAKS = /*EDITMODE-BEGIN*/{
  "chromeStyle": "labeled",
  "showLegend": true,
  "colorCoding": true,
  "dotGrid": true
}/*EDITMODE-END*/;

// ── Sample plan content ─────────────────────────────────────────────
const SAMPLE_PLAN = {
  title: 'plan.md — Migrate auth to OAuth2 PKCE',
  milestones: [
    {
      id: '1',
      name: 'Milestone 1 · Discovery',
      tasks: [
        { id: '1.1', name: 'Audit current token flow', done: true, commented: false },
        { id: '1.2', name: 'Map call sites', done: true, commented: true },
      ],
    },
    {
      id: '2',
      name: 'Milestone 2 · Implementation',
      tasks: [
        { id: '2.1', name: 'Server redirect handler', done: false, commented: true, active: true },
        { id: '2.2', name: 'Client PKCE challenge', done: false, commented: false },
        { id: '2.3', name: 'Token refresh loop', done: false, commented: false },
      ],
    },
    {
      id: '3',
      name: 'Milestone 3 · Cutover',
      tasks: [
        { id: '3.1', name: 'Feature flag rollout', done: false, commented: false },
        { id: '3.2', name: 'Legacy deprecation', done: false, commented: false },
      ],
    },
  ],
};

const FLOWCHART_SRC = `flowchart TD
  Start([Incoming request]) --> CheckToken{Valid token?}
  CheckToken -->|Yes| Serve[Serve resource]
  CheckToken -->|No| CheckRefresh{Refresh token?}
  CheckRefresh -->|Yes| Refresh[POST /oauth/token]
  CheckRefresh -->|No| Redirect[/Redirect to /login/]
  Refresh --> Validate{Refresh valid?}
  Validate -->|Yes| Serve
  Validate -->|No| Redirect
  Redirect --> Done([End])
  Serve --> Done
  ErrorNode[Auth failure log]
  Validate -.-> ErrorNode`;

const SEQUENCE_SRC = `sequenceDiagram
  participant Browser
  participant App as Client App
  participant Auth as Auth Server
  participant API
  Browser->>App: visit /dashboard
  App->>App: gen code_verifier + challenge
  App->>Auth: GET /authorize (+ challenge)
  Auth-->>Browser: login page
  Browser->>Auth: credentials
  Auth-->>App: redirect + auth code
  App->>Auth: POST /token (code + verifier)
  Auth-->>App: access + refresh token
  App->>API: GET /me (Bearer)
  API-->>App: user json
  App-->>Browser: render dashboard`;

const SMALL_FLOWCHART_SRC = `flowchart LR
  A([Client]) --> B{Has code_verifier?}
  B -->|Yes| C[Generate challenge]
  B -->|No| D[Error: missing PKCE]
  C --> E([Send to /authorize])`;

// ── Top-level app ─────────────────────────────────────────────────────
function App() {
  const [tweaks, setTweaks] = useState(TWEAKS);
  const [tweaksOpen, setTweaksOpen] = useState(false);

  // Host protocol
  useEffect(() => {
    const handler = (e) => {
      if (!e.data) return;
      if (e.data.type === '__activate_edit_mode') setTweaksOpen(true);
      if (e.data.type === '__deactivate_edit_mode') setTweaksOpen(false);
    };
    window.addEventListener('message', handler);
    window.parent.postMessage({ type: '__edit_mode_available' }, '*');
    return () => window.removeEventListener('message', handler);
  }, []);

  // Escape to close anything modal
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        document.querySelector('.mermaid-overlay')?.remove();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const setTweak = (k, v) => {
    const next = { ...tweaks, [k]: v };
    setTweaks(next);
    window.parent.postMessage({ type: '__edit_mode_set_keys', edits: { [k]: v } }, '*');
  };

  // Toggle color coding by flipping a root class
  useEffect(() => {
    document.body.classList.toggle('no-color-coding', !tweaks.colorCoding);
    document.body.classList.toggle('no-dot-grid', !tweaks.dotGrid);
  }, [tweaks.colorCoding, tweaks.dotGrid]);

  return (
    <div className="app">
      <div className="top-bar">
        <span className="mode-badge">Browser mode</span>
        <h1>{SAMPLE_PLAN.title.split('—')[0]}<span> — {SAMPLE_PLAN.title.split('—')[1]}</span></h1>
        <span className="comment-count">5 comments</span>
        <button className="submit-btn">Submit review</button>
      </div>

      <div className="panels">
        <aside className="toc-panel">
          <div className="toc-title">Table of Contents</div>
          {SAMPLE_PLAN.milestones.map(m => (
            <div key={m.id} className="toc-milestone">
              <h3>{m.name}</h3>
              <ul>
                {m.tasks.map(t => (
                  <li key={t.id} className={`toc-item ${t.active ? 'active' : ''} ${t.commented ? 'commented' : ''}`}>
                    <span className="toc-marker">{t.done ? '✓' : t.commented ? '●' : '○'}</span>
                    <span className="toc-id">{t.id}</span>
                    <span>{t.name}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </aside>

        <main className="content-area">
          <Section
            crumb="Milestone 2 · Implementation"
            id="2.1"
            title="Task 2.1 — Server redirect handler"
            active
            meta={[
              { k: 'Depends on', v: '1.2' },
              { k: 'Blocks', v: '2.2, 2.3' },
              { k: 'Verification', v: 'integration test suite' },
            ]}
          >
            <LineBlock n={1}>
              <p>Implement the OAuth2 redirect handler that receives the authorization code, exchanges it for tokens, and establishes a session. The flow below shows the decision tree for an incoming request — decision nodes are what we need tests around.</p>
            </LineBlock>

            <LineBlock n={2}>
              <MermaidBlock
                source={FLOWCHART_SRC}
                title="Request authentication flow"
                chrome={tweaks.chromeStyle}
                showLegend={tweaks.showLegend}
                commentedNodes={['ErrorNode', 'CheckToken']}
                onComment={() => {}}
              />
            </LineBlock>

            <LineBlock n={3}>
              <p>The handshake between browser, client, auth server, and API is standard OAuth2 PKCE. Note that the <code>code_verifier</code> never leaves the client:</p>
            </LineBlock>

            <LineBlock n={4}>
              <MermaidBlock
                source={SEQUENCE_SRC}
                title="PKCE token exchange"
                chrome={tweaks.chromeStyle}
                showLegend={tweaks.showLegend}
                onComment={() => {}}
              />
            </LineBlock>

            <LineBlock n={5}>
              <p><strong>Edge case:</strong> if the client hits <code>/authorize</code> without generating a verifier first, we should fail fast rather than silently retry:</p>
            </LineBlock>

            <LineBlock n={6}>
              <MermaidBlock
                source={SMALL_FLOWCHART_SRC}
                title="Verifier guard"
                chrome={tweaks.chromeStyle}
                showLegend={tweaks.showLegend}
                onComment={() => {}}
              />
            </LineBlock>
          </Section>
        </main>

        <aside className="comment-sidebar">
          <div className="sidebar-title">Comments · this section</div>

          <div className="comment-card">
            <div className="anchor-label">Line 2 · Diagram</div>
            <div className="anchor-quote">CheckToken {'{'}Valid token?{'}'}</div>
            <div className="ctext">What's the timeout on token validation? The diagram doesn't show a circuit-breaker path.</div>
            <div className="meta">· you · 2m ago</div>
          </div>

          <div className="comment-card">
            <div className="anchor-label">Line 2 · Diagram node</div>
            <div className="anchor-quote">ErrorNode[Auth failure log]</div>
            <div className="ctext">This node feels orphaned — the dotted edge from Validate is the only way in. Is that intentional?</div>
            <div className="meta">· you · 4m ago</div>
          </div>

          <div className="comment-card">
            <div className="anchor-label">Line 4 · Sequence</div>
            <div className="anchor-quote">App-&gt;&gt;Auth: POST /token</div>
            <div className="ctext">Add retry-with-backoff to this step; Auth server can 429 us under load.</div>
            <div className="meta">· you · 7m ago</div>
          </div>

          <div className="comment-card" style={{ borderColor: 'color-mix(in srgb, #facc15 40%, var(--border))' }}>
            <div className="anchor-label" style={{ color: '#facc15' }}>Line 2 · Node “ErrorNode”</div>
            <div className="anchor-quote">Auth failure log</div>
            <div className="ctext">Orphaned — only reached via dotted edge from Validate. Either wire it to the real error path or drop it.</div>
            <div className="meta">· alvaro · 1m ago</div>
          </div>

          <div className="comment-card" style={{ borderColor: 'color-mix(in srgb, #facc15 40%, var(--border))' }}>
            <div className="anchor-label" style={{ color: '#facc15' }}>Line 2 · Node “CheckToken”</div>
            <div className="anchor-quote">Valid token?</div>
            <div className="ctext">Add expiry-skew window — clocks drift.</div>
            <div className="meta">· alvaro · just now</div>
          </div>
        </aside>
      </div>

      {tweaksOpen && (
        <div className="tweaks-panel">
          <h4>Tweaks</h4>

          <div className="tw-row">
            <label>Diagram chrome</label>
            <div className="seg">
              {['minimal', 'labeled', 'terminal'].map(k => (
                <button key={k} className={tweaks.chromeStyle === k ? 'on' : ''} onClick={() => setTweak('chromeStyle', k)}>
                  {k}
                </button>
              ))}
            </div>
            <div className="tweaks-hint">
              {tweaks.chromeStyle === 'minimal' && 'Clean frame, toolbar reveals on hover.'}
              {tweaks.chromeStyle === 'labeled' && 'Title bar + diagram kind + node count.'}
              {tweaks.chromeStyle === 'terminal' && 'Code-block style, monospace chrome.'}
            </div>
          </div>

          <div className="tw-row">
            <label className="tw-check">
              <input type="checkbox" checked={tweaks.colorCoding} onChange={e => setTweak('colorCoding', e.target.checked)} />
              Color-code nodes by role
            </label>
            <label className="tw-check">
              <input type="checkbox" checked={tweaks.showLegend} onChange={e => setTweak('showLegend', e.target.checked)} />
              Show color legend
            </label>
            <label className="tw-check">
              <input type="checkbox" checked={tweaks.dotGrid} onChange={e => setTweak('dotGrid', e.target.checked)} />
              Dot-grid background
            </label>
          </div>

          <div className="tweaks-hint">
            Try the toolbar on any diagram: zoom, source toggle, copy, download, expand.
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ crumb, id, title, active, meta, children }) {
  return (
    <section className={`section-view ${active ? 'active' : ''}`}>
      <div className="section-crumb">{crumb} · #{id}</div>
      <h2>{title}</h2>
      {meta && (
        <div className="section-meta">
          {meta.map(m => <span key={m.k}><b>{m.k}:</b>{m.v}</span>)}
        </div>
      )}
      <div className="section-body">{children}</div>
    </section>
  );
}

function LineBlock({ n, children }) {
  return (
    <div className="line-block">
      <span className="line-gutter">{n}</span>
      <div className="line-inner">{children}</div>
    </div>
  );
}

// Inject a style that disables color-coding when the toggle is off
const disableStyle = document.createElement('style');
disableStyle.textContent = `
  body.no-color-coding .mermaid-surface g.node[data-role] > * {
    fill: color-mix(in srgb, var(--role-process) 18%, var(--bg-primary)) !important;
    stroke: var(--role-process) !important;
    stroke-width: 1.5px !important;
  }
  body.no-color-coding .mermaid-surface g.node[data-role] foreignObject span,
  body.no-color-coding .mermaid-surface g.node[data-role] text {
    color: var(--text-primary) !important;
    fill: var(--text-primary) !important;
    font-weight: 500 !important;
  }
  body.no-color-coding .mermaid-surface .edge-from-decision .path {
    stroke: var(--border-strong) !important;
    stroke-dasharray: none !important;
  }
  body.no-color-coding .mermaid-legend { display: none !important; }
  body.no-dot-grid .mermaid-viewport,
  body.no-dot-grid .mermaid-overlay .mo-diagram { background-image: none !important; }
`;
document.head.appendChild(disableStyle);

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
