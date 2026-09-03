/* global React, ReactDOM, MermaidBlock, ThreadCard, RailFilters, Composer */
const { useState, useEffect, useRef, useMemo, useLayoutEffect, useCallback } = React;

const TWEAKS = /*EDITMODE-BEGIN*/{
  "theme": "light",
  "agentTone": "balanced",
  "showCitations": true,
  "autoDraftReplies": true
}/*EDITMODE-END*/;

// ── Mermaid sources ───────────────────────────────────────────────
const FLOW_AUTH = `flowchart TD
  Start([Incoming request]) --> CheckToken{Valid access token?}
  CheckToken -->|Yes| Serve[Serve resource]
  CheckToken -->|No| CheckRefresh{Refresh token?}
  CheckRefresh -->|Yes| Refresh[POST /oauth/token]
  CheckRefresh -->|No| Redirect[/Redirect to /login/]
  Refresh --> Validate{Refresh valid?}
  Validate -->|Yes| Serve
  Validate -->|No| Redirect
  Redirect --> Done([End])
  Serve --> Done`;

const SEQ_PKCE = `sequenceDiagram
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

const CODE_HANDLER_HTML = `<span class="filename">redirect_handler.ts</span>
<span class="ck-kw">export async function</span> <span class="ck-fn">handleRedirect</span>(req: Request, res: Response) {
  <span class="ck-kw">const</span> { code, state } = req.query;
  <span class="ck-kw">if</span> (!code || !state) <span class="ck-kw">return</span> res.status(<span class="ck-str">400</span>).send(<span class="ck-str">'missing code or state'</span>);
  <span class="ck-kw">const</span> verifier = <span class="ck-fn">popVerifier</span>(req.session, state);
  <span class="ck-kw">if</span> (!verifier) <span class="ck-kw">return</span> res.status(<span class="ck-str">400</span>).send(<span class="ck-str">'PKCE state expired'</span>);
  <span class="ck-com">// exchange code → tokens, with a 5s timeout</span>
  <span class="ck-kw">const</span> tokens = <span class="ck-kw">await</span> <span class="ck-fn">exchangeCode</span>({ code, verifier, timeoutMs: 5000 });
  <span class="ck-fn">setSession</span>(res, tokens);
  res.redirect(<span class="ck-str">'/dashboard'</span>);
}`;

// ── Citation data ─────────────────────────────────────────────────
const CITATIONS = {
  1: { ref: 'ENG-142', src: 'linear', snippet: 'Migrate from session cookies to OAuth2 PKCE — assigned to alvaro, due May 26.' },
  2: { ref: 'src/auth/middleware.ts', src: 'file', snippet: 'Current implementation; sets opaque sid cookie after form login.' },
  3: { ref: 'RFC 7636 §4.1', src: 'rfc', snippet: 'PKCE code_verifier: 43–128 chars, [A-Z][a-z][0-9]-._~' },
  4: { ref: 'task 1.2 · audit', src: 'doc', snippet: '38 call sites map; 11 are server-only and don\'t need PKCE.' },
  5: { ref: 'incident 2025-08-14', src: 'incident', snippet: 'Auth server slowness caused 90s of timeouts; no upstream circuit breaker.' },
  6: { ref: 'OWASP ASVS 4.0 §3.5', src: 'doc', snippet: 'Refresh tokens MUST be stored in HttpOnly cookies for browser apps.' },
};

// ── Initial decisions (the AI's open questions) ───────────────────
const INITIAL_DECISIONS = [
  {
    id: 'd1',
    label: 'Backoff strategy',
    loc: '§ Overview',
    paraId: 'p-overview',
    question: 'Exponential backoff to 5s, or a fixed circuit-breaker at 90s?',
    context: 'Last incident showed cascading retries when Auth was slow. Both options trade latency vs. blast radius.',
    options: [
      { key: 'A', text: 'Exponential backoff, cap 5s. Simpler, retries opaque to client.', recommended: true, badge: 'Mira leans here' },
      { key: 'B', text: 'Fixed CB at 90s. Stronger guarantee, requires a probe.' },
      { key: 'C', text: 'Both — backoff inside a CB. More moving parts.' },
      { key: '?', text: 'Tell me a different option…', custom: true },
    ],
    resolved: false,
    ago: '3m',
  },
  {
    id: 'd2',
    label: 'Refresh-token scope',
    loc: '§ Token storage',
    paraId: 'p-storage',
    question: 'Scope the refresh-token cookie to `/oauth` or the whole site?',
    context: 'OWASP recommends narrowest scope, but our /oauth path is split across three subpaths and a redirect handler.',
    options: [
      { key: 'A', text: 'Scope to /oauth — tightest, requires routing all refresh calls through /oauth.', recommended: true, badge: 'Mira leans here' },
      { key: 'B', text: 'Scope to / — simplest, looser than OWASP recommendation.' },
      { key: '?', text: 'Tell me a different option…', custom: true },
    ],
    resolved: false,
    ago: '3m',
  },
  {
    id: 'd3',
    label: 'Legacy support window',
    loc: '§ Rollout',
    paraId: 'p-rollout',
    question: 'How long do we keep the legacy `/auth/callback` redirect alive?',
    context: 'Mobile clients pin redirect URLs and re-validate on app launch (~60% reopen within 30 days).',
    options: [
      { key: 'A', text: '30 days. Aggressive; covers ~85% of mobile reopens.' },
      { key: 'B', text: '60 days. Safer; covers ~99% based on the audit data.', recommended: true, badge: 'Mira leans here' },
      { key: 'C', text: 'Indefinite, gated by feature flag. Highest safety, more code to maintain.' },
      { key: '?', text: 'Tell me a different option…', custom: true },
    ],
    resolved: false,
    ago: '3m',
  },
];

// ── Initial threads (comments, including one with an AI-drafted reply) ────
const NOW = Date.now();
const INITIAL_THREADS = [
  {
    id: 't1',
    anchorKind: 'text',
    paraId: 'p-overview',
    loc: '§ Overview',
    quote: 'we have taken outages in the past from that alone',
    resolved: false,
    comments: [
      { author: 'alvaro', ts: NOW - 1000 * 60 * 14,
        body: "Source for this? I remember the 2025-08-14 incident, but was that actually because of missing timeouts, or were we doing infinite retries?" },
    ],
    draftReply: {
      body: "Citing incident 2025-08-14 — the post-mortem¹ found the proximate cause was retries with no backoff, but the contributing factor was the absence of an upstream timeout, which let each request hang for ~90s before failing. I'll inline that distinction so it's not misleading.",
    },
  },
  {
    id: 't2',
    anchorKind: 'node',
    diagramId: 'd-auth',
    anchorId: 'valid_access_token',
    loc: 'Flowchart · "Valid access token?"',
    quote: 'Valid access token?',
    resolved: false,
    comments: [
      { author: 'alvaro', ts: NOW - 1000 * 60 * 4,
        body: "We also need an expiry-skew window here — clocks drift. Add ±30s by default." },
    ],
  },
  {
    id: 't3',
    anchorKind: 'text',
    paraId: 'p-pkce-intro',
    loc: '§ Token exchange',
    quote: 'never leaves the client',
    resolved: false,
    comments: [
      { author: 'maya', ts: NOW - 1000 * 60 * 22,
        body: "Worth being explicit that the verifier IS sent in the token exchange — just over TLS, not in the redirect URL. 'Never leaves the client' is technically wrong." },
    ],
  },
  {
    id: 't4',
    anchorKind: 'text',
    paraId: 'p-storage',
    loc: '§ Token storage',
    quote: 'SameSite=Lax',
    resolved: true,
    comments: [
      { author: 'jin', ts: NOW - 1000 * 60 * 60, body: "Why Lax and not Strict?" },
      { author: 'you', ts: NOW - 1000 * 60 * 50, body: "Strict breaks the redirect back from /authorize. Lax is the right default for OAuth callbacks." },
    ],
  },
];

// ── Activity log (the AI's actions over time) ─────────────────────
const ACTIVITY = [
  { kind: 'agent', who: 'Mira', what: 'agent-draft', ts: NOW - 1000 * 60 * 3,
    body: 'Drafted task 2.1 from the ticket and 4 referenced sources.',
    sources: [{ k: 'linear', label: 'ENG-142' }, { k: 'rfc', label: 'RFC 7636' }, { k: 'doc', label: 'task 1.2 audit' }, { k: 'file', label: 'src/auth/middleware.ts' }] },
  { kind: 'agent', who: 'Mira', what: 'flagged', ts: NOW - 1000 * 60 * 3,
    body: 'Flagged 3 decisions for your review: backoff strategy, refresh-token cookie scope, legacy support window.' },
  { kind: 'agent', who: 'Mira', what: 'suggestion', ts: NOW - 1000 * 60 * 3,
    body: 'Drafted 2 alternative phrasings — one in the Goals list, one in the redirect handler snippet.' },
  { kind: 'system', who: 'reviewers', what: 'shared', ts: NOW - 1000 * 60 * 2,
    body: 'Shared with alvaro, maya, jin for review.' },
  { kind: 'you', who: 'you', what: 'resolved', ts: NOW - 1000 * 60 * 50,
    body: 'Resolved the SameSite question from jin.' },
  { kind: 'agent', who: 'Mira', what: 'reply-draft', ts: NOW - 1000 * 60 * 1,
    body: 'Drafted a reply to alvaro\'s question about the outage source — needs your approval before sending.' },
];

// ── Decision marker (inline) ──────────────────────────────────────
function DecisionMarker({ id, decision, resolved, onClick, children }) {
  return (
    <span
      className={`decision-marker ${resolved ? 'resolved' : ''}`}
      onClick={() => onClick(id)}
      data-decision-id={id}
    >{children}</span>
  );
}

// ── Citation footnote (inline) ────────────────────────────────────
function Cite({ n, onHover, onLeave }) {
  return (
    <a
      className="cite"
      data-cite-id={n}
      onMouseEnter={e => onHover(n, e.currentTarget)}
      onMouseLeave={onLeave}
    >{n}</a>
  );
}

// ── Cite popover ──────────────────────────────────────────────────
function CitePopover({ data }) {
  if (!data) return null;
  const c = CITATIONS[data.n];
  if (!c) return null;
  const ICO = {
    linear:   <svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0z M8 16l8-8"/></svg>,
    file:     <svg viewBox="0 0 24 24"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zm0 0v6h6"/></svg>,
    rfc:      <svg viewBox="0 0 24 24"><path d="M4 4h12l4 4v12H4z M16 4v4h4"/></svg>,
    doc:      <svg viewBox="0 0 24 24"><path d="M4 4h12l4 4v12H4z M8 12h8M8 16h6"/></svg>,
    incident: <svg viewBox="0 0 24 24"><path d="M12 2 2 22h20zM12 9v6M12 18v.5"/></svg>,
  };
  return (
    <div className="cite-pop" style={{ left: data.x, top: data.y }}>
      <div className="src-line">{ICO[c.src]}<b>{c.ref}</b></div>
      <div className="src-snippet">{c.snippet}</div>
    </div>
  );
}

// ── Inline suggestion block ───────────────────────────────────────
function Suggestion({ id, title, rationale, state, prose, onAccept, onReject, onDiscuss, conf }) {
  return (
    <div className={`suggestion ${state || ''}`} data-suggestion-id={id}>
      <div className="sg-head">
        <span className="ava">M</span>
        <span className="tag">Mira suggests</span>
        <span className="what">{title}</span>
        {conf && <span className="conf">conf {conf}</span>}
      </div>
      <div className="sg-body">
        {prose}
      </div>
      {state !== 'accepted' && state !== 'rejected' && (
        <div className="sg-foot">
          <span className="rationale">{rationale}</span>
          <button className="discuss" onClick={() => onDiscuss(id)}>Discuss</button>
          <button className="reject" onClick={() => onReject(id)}>
            <svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>
            Reject
          </button>
          <button className="accept" onClick={() => onAccept(id)}>
            <svg viewBox="0 0 24 24"><path d="m5 12 5 5L20 7"/></svg>
            Accept
          </button>
        </div>
      )}
      {(state === 'accepted' || state === 'rejected') && (
        <div className="sg-foot">
          <span className="rationale">{state === 'accepted' ? 'You accepted this suggestion. Mira applied it.' : 'You dismissed this suggestion.'}</span>
          <button className="reject" onClick={() => onReject(id, true)}>Undo</button>
        </div>
      )}
    </div>
  );
}

// ── Decision card in rail ─────────────────────────────────────────
function DecisionCard({ decision, isFocus, onPick, onJump, onFocus }) {
  return (
    <div
      className={`decision-card ${decision.resolved ? 'resolved' : ''} ${isFocus ? 'is-focus' : ''}`}
      onClick={() => onFocus(decision.id)}
      data-decision-id={decision.id}
    >
      <div className="dc-head">
        <span className="label">{decision.resolved ? 'Decided' : 'Decision needed'}</span>
        <span className="loc" onClick={(e) => { e.stopPropagation(); onJump(decision); }}>{decision.loc}</span>
        <span className="ago">{decision.ago}</span>
      </div>
      <div className="dc-question">{decision.question}</div>
      {decision.context && <div className="dc-context">{decision.context}</div>}
      {decision.resolved ? (
        <div className="dc-resolved">
          <svg viewBox="0 0 24 24"><path d="m5 12 5 5L20 7"/></svg>
          <span>You picked: <b>{decision.decidedAs}</b></span>
        </div>
      ) : (
        <div className="dc-options" onClick={e => e.stopPropagation()}>
          {decision.options.map(opt => (
            <button
              key={opt.key}
              className={`${opt.recommended ? 'recommended' : ''} ${opt.custom ? 'custom' : ''}`}
              onClick={() => onPick(decision.id, opt)}
            >
              <span className="key">{opt.key}</span>
              <span style={{ flex: 1 }}>{opt.text}</span>
              {opt.recommended && <span className="badge">{opt.badge}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Activity timeline ─────────────────────────────────────────────
const TLI = {
  draft:    () => (<svg viewBox="0 0 24 24"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6M9 13h6M9 17h4"/></svg>),
  flagged:  () => (<svg viewBox="0 0 24 24"><path d="M4 4v16M4 4h12l-2 4 2 4H4"/></svg>),
  reply:    () => (<svg viewBox="0 0 24 24"><path d="M9 14l-5-5 5-5M4 9h10a6 6 0 0 1 6 6v3"/></svg>),
  shared:   () => (<svg viewBox="0 0 24 24"><circle cx="6" cy="12" r="3"/><circle cx="18" cy="6" r="3"/><circle cx="18" cy="18" r="3"/><path d="m8.5 11 7-4M8.5 13l7 4"/></svg>),
  resolved: () => (<svg viewBox="0 0 24 24"><path d="m5 12 5 5L20 7"/></svg>),
  suggest:  () => (<svg viewBox="0 0 24 24"><path d="M9 14l3-9 3 9M11 11h2M5 20h14"/></svg>),
};
function fmtAgo(ts) {
  const d = (Date.now() - ts) / 1000;
  if (d < 60) return 'just now';
  if (d < 3600) return Math.floor(d / 60) + 'm ago';
  if (d < 86400) return Math.floor(d / 3600) + 'h ago';
  return Math.floor(d / 86400) + 'd ago';
}
function TimelineItem({ item }) {
  const iconFor = {
    'agent-draft': TLI.draft, flagged: TLI.flagged, suggestion: TLI.suggest,
    'reply-draft': TLI.reply, shared: TLI.shared, resolved: TLI.resolved,
  }[item.what] || TLI.draft;
  const Icon = iconFor;
  return (
    <div className={`tl-item ${item.kind}`}>
      <div className="tl-rail"/>
      <div className="tl-ico">{item.kind === 'agent' ? 'M' : item.kind === 'you' ? 'YO' : <Icon/>}</div>
      <div className="tl-body">
        <div className="tl-who"><b>{item.who}</b><time>{fmtAgo(item.ts)}</time></div>
        <div className="tl-what">
          {item.body}
          {item.sources && (
            <div className="sources">
              {item.sources.map((s, i) => (
                <span key={i} className="src">
                  <svg viewBox="0 0 24 24"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zm0 0v6h6"/></svg>
                  {s.label}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Document body ─────────────────────────────────────────────────
function DocBody({
  showCitations, d1Ref, d2Ref,
  decisions, onDecisionClick,
  threads, diagramThreads, makeNodeClicker, onPinClick,
  suggestionStates, onAcceptSuggestion, onRejectSuggestion, onDiscussSuggestion,
  onCiteHover, onCiteLeave,
}) {
  const C = ({ n }) => showCitations ? <Cite n={n} onHover={onCiteHover} onLeave={onCiteLeave}/> : null;
  const dec = (id) => decisions.find(d => d.id === id);
  const D = ({ id, children }) => {
    const d = dec(id);
    if (!d) return <>{children}</>;
    return <DecisionMarker id={id} resolved={d.resolved} onClick={onDecisionClick}>{children}</DecisionMarker>;
  };

  return (
    <>
      <div className="agent-byline">
        <div className="ava">M</div>
        <div>
          <div className="who">Mira <span className="role">AI Agent</span></div>
          <div className="sub">
            Drafted from <a>ENG-142</a>, <a>RFC 7636</a>, <a>task 1.2 audit</a>, <a>src/auth/middleware.ts</a> · 3m ago
          </div>
        </div>
        <div className="spacer"/>
        <span className="stat">Conf <b>med</b></span>
        <span className="stat">3 decisions · 2 suggestions</span>
        <button className="regen">
          <svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 3-7M3 5v4h4"/></svg>
          Revise
        </button>
      </div>

      <div className="doc-eyebrow">
        <span>Milestone 2 · Implementation</span>
        <span className="pill">Task 2.1</span>
        <span className="pill">Owner · @alvaro</span>
        <span className="pill">Review · you</span>
      </div>
      <h1 className="doc-title">Server redirect handler for OAuth2 PKCE</h1>
      <p className="doc-subtitle">
        Receive the authorization code, exchange it for tokens, and establish a session — without the legacy callback dance.
      </p>

      <dl className="defs">
        <dt>Depends on</dt><dd><code>1.2 · Map call sites</code><C n={4}/></dd>
        <dt>Blocks</dt><dd><code>2.2 · Client PKCE challenge</code>, <code>2.3 · Token refresh loop</code></dd>
        <dt>Verification</dt><dd>Integration test suite + staging shadow traffic for 48h</dd>
        <dt>Target cutover</dt><dd><b>Week of May 26</b><C n={1}/></dd>
      </dl>

      <h2 id="overview"><span className="h2-num">01</span>Overview</h2>
      <p data-paraid="p-overview" data-section="§ Overview">
        The current auth path uses an opaque session cookie set after a server-rendered login form<C n={2}/>. We're replacing it with the OAuth2 <strong>authorization code flow with PKCE</strong> — the recommended pattern for browser clients since RFC 7636<C n={3}/>. The redirect handler is the bridge: it receives the code, performs the token exchange, and hands the user a fresh session. This task scope is the server piece only — the client-side challenge generator is task 2.2.
        We're paying particular attention to <D id="d1">circuit-breaker behaviour when the upstream Auth server is slow</D>; the current flow has no timeouts and we have taken outages in the past from that alone<C n={5}/>.
      </p>

      <div className="callout info">
        <span className="ico">i</span>
        <div className="body">
          <b>Why PKCE.</b> Without PKCE, an attacker who intercepts the redirect URL can exchange the code themselves. The <code>code_verifier</code> binds the exchange to the original client and is presented only in the token request<C n={3}/>.
        </div>
      </div>

      <h2 id="goals"><span className="h2-num">02</span>Goals</h2>
      <ul data-paraid="p-goals" data-section="§ Goals">
        <li><b>One round-trip cutover</b> — flip the flag, every new login uses PKCE; in-flight sessions keep working until natural expiry.</li>
        <li><b>No silent retries</b> on malformed PKCE requests. We log and fail with a 400.</li>
        <li><b>Backwards-compat redirect URLs</b> — the existing <code>/auth/callback</code> path keeps working through the migration window.</li>
        <li><b>Observable</b> — every state transition emits a metric; SLO is &lt; 200ms p99 for the token exchange.</li>
      </ul>

      <Suggestion
        id="s1"
        title="Tighten the 'silent retries' goal"
        rationale="Distinguishing 4xx vs 5xx avoids ambiguity when the auth server itself is sick — currently the goal reads as if any failure is the client's fault."
        conf="0.78"
        state={suggestionStates.s1}
        onAccept={onAcceptSuggestion}
        onReject={onRejectSuggestion}
        onDiscuss={onDiscussSuggestion}
        prose={
          <div className="diff-prose">
            <span className="rem">No silent retries on malformed PKCE requests.</span> <span className="add">No silent retries on PKCE 4xx failures — those are client mistakes and must surface. For 5xx from the Auth server we retry once with a 250ms jitter, then surface.</span> We log and fail with a 400 <span className="add">(or 502 for upstream Auth failures)</span>.
          </div>
        }
      />

      <h2 id="architecture"><span className="h2-num">03</span>Request flow</h2>
      <p data-paraid="p-arch" data-section="§ Request flow">
        Every incoming request hits the auth middleware before the route handler<C n={2}/>. The middleware checks for a valid access token, attempts a refresh if there's a refresh token on the session, and falls through to the redirect handler if neither is present. The diamond nodes are what we need integration tests around.
      </p>

      <div id="d-auth" ref={d1Ref}>
        <MermaidBlock
          source={FLOW_AUTH}
          title="Request authentication flow"
          showLegend={true}
          threads={diagramThreads('d-auth')}
          onNodeClick={makeNodeClicker('d-auth', d1Ref)}
          onPinClick={onPinClick}
        />
      </div>

      <h2 id="handshake"><span className="h2-num">04</span>Token exchange</h2>
      <p data-paraid="p-pkce-intro" data-section="§ Token exchange">
        The handshake between browser, client, auth server, and API is standard OAuth2 PKCE. The <strong>code_verifier</strong> is generated client-side and never leaves the client over the redirect path — it's presented to the auth server only at the token-exchange step over TLS<C n={3}/>, proving the same client that started the flow is finishing it.
      </p>

      <div id="d-pkce" ref={d2Ref}>
        <MermaidBlock
          source={SEQ_PKCE}
          title="PKCE token exchange"
          showLegend={true}
          threads={diagramThreads('d-pkce')}
          onNodeClick={makeNodeClicker('d-pkce', d2Ref)}
          onPinClick={onPinClick}
        />
      </div>

      <h3>Token storage</h3>
      <p data-paraid="p-storage" data-section="§ Token storage">
        Access tokens are kept in memory only; refresh tokens go into an <code>HttpOnly; Secure; SameSite=Lax</code> cookie<C n={6}/> <D id="d2">scoped to <code>/oauth</code></D>. The session cookie continues to identify the user for legacy routes during the transition.
      </p>

      <pre className="code-block" dangerouslySetInnerHTML={{ __html: CODE_HANDLER_HTML }} />

      <Suggestion
        id="s2"
        title="Use Promise.race instead of a timeoutMs param"
        rationale="The current shape leaks the timeout into the exchangeCode contract. Promise.race keeps the timeout policy at the call site and matches the pattern in src/http/withTimeout.ts."
        conf="0.64"
        state={suggestionStates.s2}
        onAccept={onAcceptSuggestion}
        onReject={onRejectSuggestion}
        onDiscuss={onDiscussSuggestion}
        prose={
          <>
            <div className="diff-line rem"><span className="marker">-</span><span>const tokens = await exchangeCode({'{'} code, verifier, timeoutMs: 5000 {'}'});</span></div>
            <div className="diff-line add"><span className="marker">+</span><span>const tokens = await withTimeout(exchangeCode({'{'} code, verifier {'}'}), 5000);</span></div>
          </>
        }
      />

      <h2 id="edge-cases"><span className="h2-num">05</span>Edge cases</h2>
      <p data-paraid="p-edge" data-section="§ Edge cases">
        If the client hits <code>/authorize</code> without generating a verifier first — usually a stale tab or a misconfigured embed — we fail fast rather than silently retry. Specifically: log <code>auth.pkce.missing_verifier</code>, return 400 with a stable error code, and let the client surface a "please refresh" UI. No bounce back to login without explanation.
      </p>

      <h2 id="rollout"><span className="h2-num">06</span>Rollout</h2>
      <p data-paraid="p-rollout" data-section="§ Rollout">
        Cutover is a 4-stage flag rollout. The riskiest hop is canary → ramp, where mobile re-validation kicks in<C n={4}/>. Legacy <code>/auth/callback</code> is <D id="d3">kept alive for the migration window</D> and returns 410 Gone after.
      </p>
      <table>
        <thead><tr><th>Stage</th><th>Audience</th><th>Duration</th><th>Rollback</th></tr></thead>
        <tbody>
          <tr><td>Shadow</td><td>0% — mirror only</td><td>3 days</td><td>Flag off (instant)</td></tr>
          <tr><td>Canary</td><td>5% of new sessions, internal first</td><td>2 days</td><td>Flag off + invalidate canary cookies</td></tr>
          <tr><td>Ramp</td><td>25% → 50% → 100% over 48h</td><td>2 days</td><td>Flag pinned to last stable ramp</td></tr>
          <tr><td>Cleanup</td><td>Legacy path returns 410 Gone</td><td>—</td><td>—</td></tr>
        </tbody>
      </table>

      <div className="callout success">
        <span className="ico">✓</span>
        <div className="body">
          <b>Ready for review.</b> Once the 3 open decisions above are resolved and Mira applies the accepted suggestions, this task is ready to merge behind the <code>auth.pkce.enabled</code> flag.
        </div>
      </div>
    </>
  );
}

// ── Top-level App ─────────────────────────────────────────────────
function App() {
  const [tweaks, setTweaks] = useState(TWEAKS);
  const [tweaksOpen, setTweaksOpen] = useState(false);
  const [decisions, setDecisions] = useState(INITIAL_DECISIONS);
  const [threads, setThreads] = useState(INITIAL_THREADS);
  const [suggestionStates, setSuggestionStates] = useState({});
  const [tab, setTab] = useState('decisions');
  const [focusedId, setFocusedId] = useState(null);
  const [citePop, setCitePop] = useState(null);
  const [composer, setComposer] = useState(null);

  const docScrollRef = useRef(null);
  const docRef = useRef(null);
  const d1Ref = useRef(null), d2Ref = useRef(null);

  useEffect(() => {
    document.body.classList.add('hitl');
    return () => document.body.classList.remove('hitl');
  }, []);

  useEffect(() => {
    document.body.classList.toggle('dark', tweaks.theme === 'dark');
  }, [tweaks.theme]);

  // Host protocol
  useEffect(() => {
    const h = (e) => {
      if (!e.data) return;
      if (e.data.type === '__activate_edit_mode') setTweaksOpen(true);
      if (e.data.type === '__deactivate_edit_mode') setTweaksOpen(false);
    };
    window.addEventListener('message', h);
    window.parent.postMessage({ type: '__edit_mode_available' }, '*');
    return () => window.removeEventListener('message', h);
  }, []);
  const setTweak = (k, v) => {
    const next = { ...tweaks, [k]: v };
    setTweaks(next);
    window.parent.postMessage({ type: '__edit_mode_set_keys', edits: { [k]: v } }, '*');
  };

  // Wrap initial text quotes into ranges
  useLayoutEffect(() => {
    threads.filter(t => t.anchorKind === 'text' && t.paraId && t.quote).forEach(t => {
      const para = docRef.current?.querySelector(`[data-paraid="${t.paraId}"]`);
      if (!para || para.querySelector(`[data-thread-id="${t.id}"]`)) return;
      const tw = document.createTreeWalker(para, NodeFilter.SHOW_TEXT);
      const nodes = []; while (tw.nextNode()) nodes.push(tw.currentNode);
      for (const node of nodes) {
        const idx = node.nodeValue.indexOf(t.quote);
        if (idx === -1) continue;
        const range = document.createRange();
        range.setStart(node, idx); range.setEnd(node, idx + t.quote.length);
        const span = document.createElement('span');
        span.className = `comment-range ${t.resolved ? 'resolved' : ''}`;
        span.dataset.threadId = t.id;
        try { range.surroundContents(span); } catch {}
        break;
      }
    });
    // eslint-disable-next-line
  }, []);

  // Inline range click → focus thread
  useEffect(() => {
    const onClick = (e) => {
      const r = e.target.closest('.comment-range');
      if (!r) return;
      const id = r.dataset.threadId;
      setFocusedId(id);
      setTab('comments');
      document.querySelectorAll('.comment-range.is-focus').forEach(el => el.classList.remove('is-focus'));
      r.classList.add('is-focus');
    };
    docRef.current?.addEventListener('click', onClick);
    return () => docRef.current?.removeEventListener('click', onClick);
  }, []);

  // Citation hover
  const onCiteHover = (n, target) => {
    const rect = target.getBoundingClientRect();
    const docRect = docRef.current.getBoundingClientRect();
    setCitePop({ n, x: rect.left - docRect.left + 14, y: rect.top - docRect.top + 18 });
  };
  const onCiteLeave = () => setCitePop(null);

  // Decisions
  const onDecisionClick = (id) => {
    setTab('decisions');
    setFocusedId(id);
    setTimeout(() => {
      document.querySelector(`[data-decision-id="${id}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }, 20);
  };
  const pickDecision = (id, opt) => {
    if (opt.custom) {
      // Open a tiny composer in the rail card area (simulated)
      const node = document.querySelector(`[data-decision-id="${id}"]`);
      const r = node?.getBoundingClientRect();
      setComposer({
        x: 60, y: window.innerHeight / 2 - 80,
        kind: 'decision-custom',
        quote: decisions.find(d => d.id === id)?.question,
        payload: { decisionId: id },
      });
      return;
    }
    setDecisions(prev => prev.map(d => d.id === id ? { ...d, resolved: true, decidedAs: opt.text.split('.')[0] } : d));
  };
  const jumpToDecision = (d) => {
    const para = docRef.current.querySelector(`[data-paraid="${d.paraId}"]`)
              || docRef.current.querySelector(`[data-decision-id="${d.id}"]`);
    if (para) {
      docScrollRef.current.scrollTo({
        top: para.getBoundingClientRect().top + docScrollRef.current.scrollTop - 120,
        behavior: 'smooth',
      });
    }
  };

  // Suggestions
  const onAcceptSuggestion = (id) => setSuggestionStates(s => ({ ...s, [id]: 'accepted' }));
  const onRejectSuggestion = (id, undo) => setSuggestionStates(s => ({ ...s, [id]: undo ? undefined : 'rejected' }));
  const onDiscussSuggestion = (id) => {
    setComposer({
      x: 80, y: window.innerHeight / 2 - 80,
      kind: 'suggestion-discuss',
      quote: `Mira's suggestion ${id}`,
      payload: { suggestionId: id },
    });
  };

  // Threads
  const onReplyToThread = (tid, body) => {
    setThreads(prev => prev.map(t => t.id === tid
      ? { ...t, comments: [...t.comments, { author: 'you', ts: Date.now(), body }] } : t));
  };
  const resolveThread = (tid) => {
    setThreads(prev => prev.map(t => t.id === tid ? { ...t, resolved: true, draftReply: null } : t));
    document.querySelector(`[data-thread-id="${tid}"].comment-range`)?.classList.add('resolved');
  };
  const unresolveThread = (tid) => {
    setThreads(prev => prev.map(t => t.id === tid ? { ...t, resolved: false } : t));
    document.querySelector(`[data-thread-id="${tid}"].comment-range`)?.classList.remove('resolved');
  };
  const sendDraftReply = (tid) => {
    setThreads(prev => prev.map(t => {
      if (t.id !== tid || !t.draftReply) return t;
      return {
        ...t,
        comments: [...t.comments, { author: 'you', ts: Date.now(), body: t.draftReply.body }],
        draftReply: null,
      };
    }));
  };
  const discardDraftReply = (tid) => {
    setThreads(prev => prev.map(t => t.id === tid ? { ...t, draftReply: null } : t));
  };
  const editDraftReply = (tid) => {
    setComposer({
      x: 80, y: window.innerHeight / 2 - 80,
      kind: 'edit-draft',
      quote: 'Edit Mira\'s draft before sending',
      payload: { threadId: tid },
    });
  };

  const jumpToThread = (t) => {
    let el;
    if (t.anchorKind === 'text') {
      el = docRef.current.querySelector(`[data-thread-id="${t.id}"]`)
        || docRef.current.querySelector(`[data-paraid="${t.paraId}"]`);
    } else if (t.anchorKind === 'node') {
      el = docRef.current.querySelector(`#${t.diagramId}`);
    }
    if (el) {
      docScrollRef.current.scrollTo({ top: el.getBoundingClientRect().top + docScrollRef.current.scrollTop - 120, behavior: 'smooth' });
      el.classList.add('is-focus');
      setTimeout(() => el.classList.remove('is-focus'), 1500);
    }
    setFocusedId(t.id);
  };

  const focusFromPin = (tid) => {
    setTab('comments');
    setFocusedId(tid);
    setTimeout(() => {
      document.querySelector(`[data-thread-id="${tid}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }, 30);
  };
  const makeNodeClicker = (diagramId, ref) => (anchorId, quote, x, y) => {
    const dRect = ref.current?.getBoundingClientRect();
    if (!dRect) return;
    const docRect = docRef.current.getBoundingClientRect();
    setComposer({
      x: dRect.left - docRect.left + x - 130,
      y: dRect.top - docRect.top + y + 20,
      kind: 'node',
      quote,
      payload: { anchorId, diagramId },
    });
  };
  const submitComposer = (text) => {
    if (!composer) return;
    if (composer.kind === 'node') {
      const id = 't' + (Date.now() % 100000);
      setThreads(prev => [{
        id, anchorKind: 'node', diagramId: composer.payload.diagramId,
        anchorId: composer.payload.anchorId, loc: `Diagram · "${composer.quote}"`,
        quote: composer.quote, resolved: false,
        comments: [{ author: 'you', ts: Date.now(), body: text }],
      }, ...prev]);
      setTab('comments');
      setFocusedId(id);
    } else if (composer.kind === 'decision-custom') {
      const did = composer.payload.decisionId;
      setDecisions(prev => prev.map(d => d.id === did ? { ...d, resolved: true, decidedAs: text } : d));
    } else if (composer.kind === 'suggestion-discuss') {
      // Append as a clarifying note — not implemented as a thread; just toast for now.
    } else if (composer.kind === 'edit-draft') {
      const tid = composer.payload.threadId;
      setThreads(prev => prev.map(t => {
        if (t.id !== tid) return t;
        return {
          ...t,
          comments: [...t.comments, { author: 'you', ts: Date.now(), body: text }],
          draftReply: null,
        };
      }));
    }
    setComposer(null);
  };

  const diagramThreads = (id) => threads.filter(t => t.diagramId === id);

  const decisionsOpen = decisions.filter(d => !d.resolved);
  const commentsOpen = threads.filter(t => !t.resolved);
  const hasFocusComments = focusedId;

  return (
    <div className="app">
      <Topbar decisionsOpen={decisionsOpen.length}/>

      <div className="decisions-bar">
        <span className="dot"/>
        <span><b>Mira is awaiting your input</b> on {decisionsOpen.length} {decisionsOpen.length === 1 ? 'decision' : 'decisions'}.</span>
        <span className="spacer"/>
        <button onClick={() => { setTab('decisions'); }}>
          <svg viewBox="0 0 24 24"><path d="M4 6h16M7 12h10M10 18h4"/></svg>
          Review now
        </button>
        <button className="primary">
          Approve all recommended
        </button>
      </div>

      <div className="panels">
        <TOC active="2.1"/>

        <div className="doc-scroll" ref={docScrollRef}>
          <article className="doc" ref={docRef}>
            <DocBody
              showCitations={tweaks.showCitations}
              d1Ref={d1Ref} d2Ref={d2Ref}
              decisions={decisions}
              onDecisionClick={onDecisionClick}
              threads={threads}
              diagramThreads={diagramThreads}
              makeNodeClicker={makeNodeClicker}
              onPinClick={focusFromPin}
              suggestionStates={suggestionStates}
              onAcceptSuggestion={onAcceptSuggestion}
              onRejectSuggestion={onRejectSuggestion}
              onDiscussSuggestion={onDiscussSuggestion}
              onCiteHover={onCiteHover}
              onCiteLeave={onCiteLeave}
            />
            <CitePopover data={citePop}/>
            {composer && (
              <Composer
                x={Math.max(20, composer.x)}
                y={composer.y}
                quote={composer.quote}
                placeholder={
                  composer.kind === 'decision-custom' ? 'Describe what you want…' :
                  composer.kind === 'edit-draft' ? 'Edit Mira\'s draft reply…' :
                  composer.kind === 'suggestion-discuss' ? 'Tell Mira what to do instead…' :
                  undefined
                }
                onSubmit={submitComposer}
                onCancel={() => setComposer(null)}
              />
            )}
          </article>
        </div>

        <aside className="rail">
          <div className="rail-tabs">
            <button
              className={`${tab === 'decisions' ? 'on decisions' : ''}`}
              onClick={() => setTab('decisions')}
            >
              Decisions <span className="pip">{decisionsOpen.length}</span>
            </button>
            <button
              className={`${tab === 'comments' ? 'on' : ''}`}
              onClick={() => setTab('comments')}
            >
              Comments <span className="pip">{commentsOpen.length}</span>
            </button>
            <button
              className={`${tab === 'activity' ? 'on activity' : ''}`}
              onClick={() => setTab('activity')}
            >
              Activity <span className="pip">{ACTIVITY.length}</span>
            </button>
          </div>
          <div className="rail-body">
            {tab === 'decisions' && (
              decisions.length === 0
                ? <div className="empty-state"><div className="glyph">␣</div>No open decisions.</div>
                : <>
                    {decisions.map(d => (
                      <DecisionCard
                        key={d.id}
                        decision={d}
                        isFocus={focusedId === d.id}
                        onPick={pickDecision}
                        onJump={jumpToDecision}
                        onFocus={setFocusedId}
                      />
                    ))}
                  </>
            )}

            {tab === 'comments' && (
              threads.length === 0
                ? <div className="empty-state"><div className="glyph">␣</div>No threads yet.</div>
                : threads.map(t => (
                  <ThreadCardWithAgent
                    key={t.id}
                    thread={t}
                    isFocus={focusedId === t.id}
                    onFocus={setFocusedId}
                    onJump={jumpToThread}
                    onResolve={resolveThread}
                    onUnresolve={unresolveThread}
                    onReply={onReplyToThread}
                    sendDraftReply={sendDraftReply}
                    editDraftReply={editDraftReply}
                    discardDraftReply={discardDraftReply}
                  />
                ))
            )}

            {tab === 'activity' && (
              <div className="timeline">
                {ACTIVITY.slice().reverse().map((item, i) => <TimelineItem key={i} item={item}/>)}
              </div>
            )}
          </div>
        </aside>
      </div>

      {tweaksOpen && (
        <TweaksPanel tweaks={tweaks} setTweak={setTweak} onClose={() => {
          setTweaksOpen(false);
          window.parent.postMessage({ type: '__edit_mode_dismissed' }, '*');
        }}/>
      )}
    </div>
  );
}

// ── Topbar (agent-flavored) ───────────────────────────────────────
function Topbar({ decisionsOpen }) {
  return (
    <header className="topbar">
      <div className="tb-brand">
        <div className="tb-mark">P</div>
        <div className="tb-brand-name">plan-review</div>
      </div>
      <div className="tb-crumbs">
        <span>Migrate auth to OAuth2 PKCE</span>
        <span className="crumb-sep">/</span>
        <span>Milestone 2</span>
        <span className="crumb-sep">/</span>
        <b>Task 2.1 · Server redirect handler</b>
        <span className="tb-status drafted">Drafted by Mira</span>
      </div>
      <div className="tb-agent">
        <div className="ava">M</div>
        <span><b>Mira</b></span>
        <span className="role">AI</span>
      </div>
      <button className="tb-btn primary">Submit review</button>
    </header>
  );
}

// ── TOC w/ HITL state markers ─────────────────────────────────────
function TOC({ active }) {
  const items = [
    { id: 'M1', name: 'Discovery', progress: 1.0, tasks: [
      { id: '1.1', name: 'Audit current token flow', state: 'approved' },
      { id: '1.2', name: 'Map call sites', state: 'approved' },
    ]},
    { id: 'M2', name: 'Implementation', progress: 0.1, tasks: [
      { id: '2.1', name: 'Server redirect handler', state: 'needs-input', decisions: 3, active: true },
      { id: '2.2', name: 'Client PKCE challenge', state: 'drafted' },
      { id: '2.3', name: 'Token refresh loop', state: 'queued' },
    ]},
    { id: 'M3', name: 'Cutover', progress: 0, tasks: [
      { id: '3.1', name: 'Feature flag rollout', state: 'queued' },
      { id: '3.2', name: 'Legacy deprecation', state: 'queued' },
    ]},
  ];
  const dotFor = (s) => {
    if (s === 'approved') return 'done';
    if (s === 'needs-input') return 'active';
    return 'todo';
  };
  return (
    <aside className="toc">
      <div className="toc-header">
        <span className="grow">Plan outline</span>
        <span className="count">7 tasks</span>
      </div>
      {items.map(m => (
        <div key={m.id} className="toc-milestone">
          <div className="toc-mile-head" data-mile={m.id}>
            <span>{m.name}</span>
            <span className="toc-mile-bar"><i style={{ width: `${m.progress * 100}%` }}/></span>
          </div>
          {m.tasks.map(t => (
            <a key={t.id} href={`#${t.id}`} className={`toc-item ${active === t.id ? 'active' : ''}`}>
              <span className="toc-num">{t.id}</span>
              <span className={`toc-dot ${dotFor(t.state)}`}/>
              <span>{t.name}</span>
              {t.decisions > 0 && <span className="toc-comment-pip" style={{ background: 'var(--decision-soft)', color: 'var(--decision)' }}>{t.decisions}</span>}
            </a>
          ))}
        </div>
      ))}
    </aside>
  );
}

// ── Tweaks panel ──────────────────────────────────────────────────
function TweaksPanel({ tweaks, setTweak, onClose }) {
  return (
    <div className="tweaks">
      <div className="tweaks-head">
        <h4>Tweaks</h4>
        <button onClick={onClose}>×</button>
      </div>
      <div className="tweaks-body">
        <div className="tw-row">
          <label className="lab">Theme</label>
          <div className="tw-seg">
            {['light', 'dark'].map(k => (
              <button key={k} className={tweaks.theme === k ? 'on' : ''} onClick={() => setTweak('theme', k)}>{k}</button>
            ))}
          </div>
        </div>
        <div className="tw-row">
          <label className="lab">Agent tone</label>
          <div className="tw-seg">
            {['cautious', 'balanced', 'decisive'].map(k => (
              <button key={k} className={tweaks.agentTone === k ? 'on' : ''} onClick={() => setTweak('agentTone', k)}>{k}</button>
            ))}
          </div>
        </div>
        <div className="tw-row">
          <label className="tw-check">
            <input type="checkbox" checked={tweaks.showCitations} onChange={e => setTweak('showCitations', e.target.checked)}/>
            Show citations
          </label>
          <label className="tw-check">
            <input type="checkbox" checked={tweaks.autoDraftReplies} onChange={e => setTweak('autoDraftReplies', e.target.checked)}/>
            Mira drafts replies for me
          </label>
        </div>
      </div>
    </div>
  );
}

// ── ThreadCard variant that surfaces a Mira-drafted reply if present ──
function ThreadCardWithAgent({
  thread, isFocus, onFocus, onJump, onResolve, onUnresolve, onReply,
  sendDraftReply, editDraftReply, discardDraftReply,
}) {
  const [reply, setReply] = useState('');
  const [showReply, setShowReply] = useState(false);
  const inputRef = useRef(null);
  useEffect(() => { if (showReply) setTimeout(() => inputRef.current?.focus(), 30); }, [showReply]);
  const submit = () => {
    if (!reply.trim()) return;
    onReply(thread.id, reply.trim());
    setReply(''); setShowReply(false);
  };

  return (
    <div
      className={`thread ${thread.resolved ? 'resolved' : ''} ${isFocus ? 'is-focus' : ''}`}
      onClick={() => onFocus(thread.id)}
      data-thread-id={thread.id}
    >
      <div className="thread-anchor">
        <span className={`kind ${thread.anchorKind}`}>{thread.anchorKind}</span>
        <span className="loc" onClick={(e) => { e.stopPropagation(); onJump(thread); }}>{thread.loc}</span>
        <span className="spacer"/>
        {thread.resolved && (
          <span className="resolved-badge">
            <svg viewBox="0 0 24 24"><path d="m5 12 5 5L20 7"/></svg> Resolved
          </span>
        )}
      </div>
      {thread.quote && <div className="thread-quote">"{thread.quote}"</div>}

      {thread.comments.map((c, i) => (
        <div key={i} className={`comment-row ${c.kind === 'agent' ? 'agent' : ''}`}>
          <div className="avatar" style={{ background: window.commentHelpers.authorColor(c.author) }}>
            {window.commentHelpers.initials(c.author)}
          </div>
          <div className="col">
            <div className="who">
              <b>{c.author}</b>
              <time>{window.commentHelpers.fmtTime(c.ts)}</time>
            </div>
            <div className="comment-text">{window.commentHelpers.formatBody(c.body)}</div>
          </div>
        </div>
      ))}

      {thread.draftReply && !thread.resolved && (
        <div className="comment-row agent draft" onClick={e => e.stopPropagation()}>
          <div className="avatar">M</div>
          <div className="col">
            <div className="who"><b>Mira</b><time>just now</time></div>
            <div className="comment-text">{window.commentHelpers.formatBody(thread.draftReply.body)}</div>
            <div className="draft-actions">
              <button onClick={() => editDraftReply(thread.id)}>Edit</button>
              <button onClick={() => discardDraftReply(thread.id)}>Discard</button>
              <button className="send" onClick={() => sendDraftReply(thread.id)}>Send as you</button>
            </div>
          </div>
        </div>
      )}

      {showReply ? (
        <div className="reply-row" onClick={e => e.stopPropagation()}>
          <div className="avatar" style={{ background: window.commentHelpers.authorColor('you') }}>YO</div>
          <input
            ref={inputRef}
            placeholder="Reply…"
            value={reply}
            onChange={e => setReply(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
              if (e.key === 'Escape') { setReply(''); setShowReply(false); }
            }}
          />
          <button className="send" onClick={submit} disabled={!reply.trim()}>
            <svg viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth="2"><path d="M3 12 21 3l-9 18-2-7-7-2z"/></svg>
          </button>
        </div>
      ) : (
        <div className="thread-actions" onClick={e => e.stopPropagation()}>
          {!thread.resolved && <button onClick={() => setShowReply(true)}>
            <svg viewBox="0 0 24 24"><path d="M9 14l-5-5 5-5M4 9h10a6 6 0 0 1 6 6v3"/></svg>
            Reply
          </button>}
          <span className="spacer"/>
          {!thread.resolved
            ? <button className="resolve" onClick={() => onResolve(thread.id)}>
                <svg viewBox="0 0 24 24"><path d="m5 12 5 5L20 7"/></svg> Resolve
              </button>
            : <button onClick={() => onUnresolve(thread.id)}>
                <svg viewBox="0 0 24 24"><path d="M3 7v6h6M3 13a9 9 0 1 0 3-7"/></svg> Reopen
              </button>}
        </div>
      )}
    </div>
  );
}

// Load Google Fonts (Geist + Newsreader)
(function loadFonts() {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500&family=Newsreader:ital,wght@0,400;0,500;0,600;1,400;1,500&display=swap';
  document.head.appendChild(link);
})();

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
