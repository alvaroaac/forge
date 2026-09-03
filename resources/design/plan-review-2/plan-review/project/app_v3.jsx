/* global React, ReactDOM, MermaidBlock, ThreadCard, RailFilters, Composer */
const { useState, useEffect, useRef, useMemo, useLayoutEffect, useCallback } = React;

// ── Tweak defaults (persisted) ─────────────────────────────────────
const TWEAKS = /*EDITMODE-BEGIN*/{
  "theme": "light",
  "density": "comfortable",
  "showGutterPins": true,
  "showLegend": true
}/*EDITMODE-END*/;

// ── Diagram sources ────────────────────────────────────────────────
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
  Serve --> Done
  ErrorNode[Auth failure log]
  Validate -.-> ErrorNode`;

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

const FLOW_VERIFIER = `flowchart LR
  A([Client]) --> B{Has code_verifier?}
  B -->|Yes| C[Generate challenge]
  B -->|No| D[Error: missing PKCE]
  C --> E([Send to /authorize])`;

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

// ── Sample document tree for TOC ───────────────────────────────────
const PLAN = {
  title: 'Migrate auth to OAuth2 PKCE',
  milestones: [
    { id: 'M1', name: 'Discovery', progress: 1.0, tasks: [
      { id: '1.1', name: 'Audit current token flow', done: true },
      { id: '1.2', name: 'Map call sites', done: true, comments: 1 },
    ]},
    { id: 'M2', name: 'Implementation', progress: 0.1, tasks: [
      { id: '2.1', name: 'Server redirect handler', done: false, active: true, comments: 5 },
      { id: '2.2', name: 'Client PKCE challenge', done: false },
      { id: '2.3', name: 'Token refresh loop', done: false },
    ]},
    { id: 'M3', name: 'Cutover', progress: 0, tasks: [
      { id: '3.1', name: 'Feature flag rollout', done: false },
      { id: '3.2', name: 'Legacy deprecation', done: false },
    ]},
  ],
};

// ── Initial seed threads ───────────────────────────────────────────
const NOW = Date.now();
const INITIAL_THREADS = [
  {
    id: 't1',
    anchorKind: 'text',
    paraId: 'p-overview',
    loc: '§ Overview',
    quote: "circuit-breaker behaviour when the upstream Auth server is slow",
    resolved: false,
    comments: [
      { author: 'alvaro', ts: NOW - 1000 * 60 * 14,
        body: "We discussed this in last week's sync — @you can you confirm we want exponential backoff vs. fixed circuit-breaker? Mixing both has bitten us before." },
      { author: 'you', ts: NOW - 1000 * 60 * 8,
        body: "Let's start with exponential backoff capped at 5s, then revisit after we see real traffic. Fixed CB feels premature." },
    ],
  },
  {
    id: 't2',
    anchorKind: 'text',
    paraId: 'p-pkce-intro',
    loc: '§ Token exchange',
    quote: "code_verifier",
    resolved: false,
    comments: [
      { author: 'maya', ts: NOW - 1000 * 60 * 22,
        body: "Tiny nit: should we mention the 43–128 char length requirement here? Folks have copy-pasted shorter strings from blog posts." },
    ],
  },
  {
    id: 't3',
    anchorKind: 'node',
    diagramId: 'd-auth',
    anchorId: 'valid_access_token',
    loc: 'Flowchart · "Valid access token?"',
    quote: 'Valid access token?',
    resolved: false,
    comments: [
      { author: 'alvaro', ts: NOW - 1000 * 60 * 4,
        body: "Add expiry-skew window — clocks drift, and we've already burned 30m on this once." },
    ],
  },
  {
    id: 't4',
    anchorKind: 'node',
    diagramId: 'd-auth',
    anchorId: 'auth_failure_log',
    loc: 'Flowchart · "Auth failure log"',
    quote: 'Auth failure log',
    resolved: true,
    comments: [
      { author: 'jin', ts: NOW - 1000 * 60 * 60,
        body: "This node is orphaned — only reached via the dotted line. Should we wire it into the real error path or drop it?" },
      { author: 'you', ts: NOW - 1000 * 60 * 45,
        body: "Good catch. I'll drop the dotted edge and route failures through the redirect handler instead." },
    ],
  },
  {
    id: 't5',
    anchorKind: 'text',
    paraId: 'p-error-edge',
    loc: '§ Edge cases',
    quote: "fail fast rather than silently retry",
    resolved: false,
    comments: [
      { author: 'rin', ts: NOW - 1000 * 60 * 2,
        body: "+1. Silent retry on missing PKCE has burned us in two other places. @maya can we add a metric for this so we can alert?" },
    ],
  },
];

// ── Selection helpers ──────────────────────────────────────────────
function getSelectionMeta(scopeEl) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
  const range = sel.getRangeAt(0);
  if (!scopeEl.contains(range.commonAncestorContainer)) return null;
  // Find the closest commentable paragraph
  let node = range.commonAncestorContainer;
  if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
  const para = node.closest('[data-paraid]');
  if (!para) return null;
  const text = sel.toString().trim();
  if (!text || text.length < 2) return null;
  const rect = range.getBoundingClientRect();
  return { range, rect, paraId: para.dataset.paraid, paraSection: para.dataset.section, text };
}

function wrapRangeInThread(range, threadId) {
  try {
    const span = document.createElement('span');
    span.className = 'comment-range';
    span.dataset.threadId = threadId;
    range.surroundContents(span);
    return true;
  } catch {
    return false; // selection crossed element boundaries
  }
}

// ── App ────────────────────────────────────────────────────────────
function App() {
  const [tweaks, setTweaks] = useState(TWEAKS);
  const [tweaksOpen, setTweaksOpen] = useState(false);
  const [threads, setThreads] = useState(INITIAL_THREADS);
  const [filter, setFilter] = useState('open');
  const [focusId, setFocusId] = useState(null);
  const [selPill, setSelPill] = useState(null);       // { x, y, sel }
  const [composer, setComposer] = useState(null);     // { x, y, kind, quote, payload }
  const [pinPositions, setPinPositions] = useState({}); // { threadId: y }
  const [activeSection, setActiveSection] = useState('overview');

  const docScrollRef = useRef(null);
  const docRef = useRef(null);

  // Host protocol — tweaks panel
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

  const setTweak = (k, v) => {
    const next = { ...tweaks, [k]: v };
    setTweaks(next);
    window.parent.postMessage({ type: '__edit_mode_set_keys', edits: { [k]: v } }, '*');
  };

  // Apply theme class + density
  useEffect(() => {
    document.body.classList.toggle('dark', tweaks.theme === 'dark');
    document.body.classList.toggle('compact', tweaks.density === 'compact');
  }, [tweaks.theme, tweaks.density]);

  // Re-wrap initial text-anchored quotes inside their paragraphs once on mount
  useLayoutEffect(() => {
    threads.filter(t => t.anchorKind === 'text' && t.paraId && t.quote).forEach(t => {
      const para = docRef.current?.querySelector(`[data-paraid="${t.paraId}"]`);
      if (!para) return;
      if (para.querySelector(`[data-thread-id="${t.id}"]`)) return; // already wrapped
      const tw = document.createTreeWalker(para, NodeFilter.SHOW_TEXT);
      const nodes = [];
      while (tw.nextNode()) nodes.push(tw.currentNode);
      for (const node of nodes) {
        const idx = node.nodeValue.indexOf(t.quote);
        if (idx === -1) continue;
        const range = document.createRange();
        range.setStart(node, idx);
        range.setEnd(node, idx + t.quote.length);
        const span = document.createElement('span');
        span.className = `comment-range ${t.resolved ? 'resolved' : ''}`;
        span.dataset.threadId = t.id;
        try { range.surroundContents(span); } catch {}
        break;
      }
    });
    // After wrapping, compute pin positions
    recomputePins();
    // eslint-disable-next-line
  }, []);

  // Wire click handlers on inline ranges
  useEffect(() => {
    const onClick = (e) => {
      const r = e.target.closest('.comment-range');
      if (!r) return;
      const id = r.dataset.threadId;
      setFocusId(id);
      document.querySelectorAll('.comment-range.is-focus').forEach(el => el.classList.remove('is-focus'));
      r.classList.add('is-focus');
      // scroll thread into view in the rail
      setTimeout(() => {
        document.querySelector(`[data-thread-id="${id}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }, 20);
    };
    docRef.current?.addEventListener('click', onClick);
    return () => docRef.current?.removeEventListener('click', onClick);
  }, [threads]);

  // Compute gutter pin positions for text-anchored, paragraph-attached threads
  const recomputePins = useCallback(() => {
    if (!docRef.current || !docScrollRef.current) return;
    const docRect = docRef.current.getBoundingClientRect();
    const next = {};
    threads.forEach(t => {
      if (t.anchorKind !== 'text' || !t.paraId) return;
      const para = docRef.current.querySelector(`[data-paraid="${t.paraId}"]`);
      if (!para) return;
      // Prefer to anchor on the wrapped range, falling back to paragraph top
      const range = para.querySelector(`[data-thread-id="${t.id}"]`);
      const r = (range || para).getBoundingClientRect();
      next[t.id] = r.top - docRect.top + 4;
    });
    setPinPositions(next);
  }, [threads]);

  useLayoutEffect(() => {
    recomputePins();
    const onResize = () => recomputePins();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [threads, recomputePins, tweaks.density]);

  // Selection: show floating pill
  useEffect(() => {
    const onMouseUp = () => {
      setTimeout(() => {
        const meta = getSelectionMeta(docRef.current);
        if (!meta) { setSelPill(null); return; }
        const docRect = docRef.current.getBoundingClientRect();
        setSelPill({
          x: meta.rect.left - docRect.left + meta.rect.width / 2 - 50,
          y: meta.rect.top - docRect.top - 38,
          meta,
        });
      }, 10);
    };
    docRef.current?.addEventListener('mouseup', onMouseUp);
    const onMouseDown = (e) => {
      if (!e.target.closest('.sel-pill') && !e.target.closest('.composer-card')) {
        setSelPill(null);
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => {
      docRef.current?.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('mousedown', onMouseDown);
    };
  }, []);

  const openTextComposer = () => {
    if (!selPill) return;
    const meta = selPill.meta;
    // Save the range; surroundContents will mutate DOM on submit
    setComposer({
      x: selPill.x - 130,
      y: selPill.y + 32,
      kind: 'text',
      quote: meta.text,
      payload: { range: meta.range.cloneRange(), paraId: meta.paraId, sectionLabel: meta.paraSection },
    });
    setSelPill(null);
    // Clear the visual selection
    window.getSelection()?.removeAllRanges();
  };

  // Node click handler — opens composer pinned to the diagram
  const onNodeClick = (anchorId, quote, x, y, diagramRect, diagramId) => {
    // Convert diagram coords to doc-relative
    const docRect = docRef.current.getBoundingClientRect();
    setComposer({
      x: diagramRect.left - docRect.left + x - 130,
      y: diagramRect.top - docRect.top + y + 20,
      kind: 'node',
      quote,
      payload: { anchorId, diagramId },
    });
  };

  // Submit composer
  const submitComment = (text) => {
    if (!composer) return;
    const id = 't' + (Date.now() % 100000);
    const base = {
      id, resolved: false, quote: composer.quote,
      comments: [{ author: 'you', ts: Date.now(), body: text }],
    };
    let newThread;
    if (composer.kind === 'text') {
      newThread = {
        ...base,
        anchorKind: 'text',
        paraId: composer.payload.paraId,
        loc: composer.payload.sectionLabel || 'Document',
      };
      // Visually wrap the range
      wrapRangeInThread(composer.payload.range, id);
      // Add focus class
      setTimeout(() => {
        document.querySelector(`[data-thread-id="${id}"]`)?.classList.add('is-focus');
      }, 10);
    } else if (composer.kind === 'node') {
      newThread = {
        ...base,
        anchorKind: 'node',
        diagramId: composer.payload.diagramId,
        anchorId: composer.payload.anchorId,
        loc: `Flowchart · "${composer.quote}"`,
      };
    }
    setThreads(prev => [newThread, ...prev]);
    setFocusId(id);
    setComposer(null);
    setTimeout(recomputePins, 30);
  };

  const replyTo = (tid, body) => {
    setThreads(prev => prev.map(t => t.id === tid
      ? { ...t, comments: [...t.comments, { author: 'you', ts: Date.now(), body }] }
      : t));
  };
  const resolveThread = (tid) => {
    setThreads(prev => prev.map(t => t.id === tid ? { ...t, resolved: true } : t));
    document.querySelector(`[data-thread-id="${tid}"].comment-range`)?.classList.add('resolved');
  };
  const unresolveThread = (tid) => {
    setThreads(prev => prev.map(t => t.id === tid ? { ...t, resolved: false } : t));
    document.querySelector(`[data-thread-id="${tid}"].comment-range`)?.classList.remove('resolved');
  };
  const jumpTo = (thread) => {
    let el;
    if (thread.anchorKind === 'text') {
      el = docRef.current.querySelector(`[data-thread-id="${thread.id}"]`)
        || docRef.current.querySelector(`[data-paraid="${thread.paraId}"]`);
    } else if (thread.anchorKind === 'node') {
      el = docRef.current.querySelector(`#${thread.diagramId}`);
    }
    if (el) {
      docScrollRef.current.scrollTo({ top: el.getBoundingClientRect().top + docScrollRef.current.scrollTop - 120, behavior: 'smooth' });
      el.classList.add('is-focus');
      setTimeout(() => el.classList.remove('is-focus'), 1500);
    }
    setFocusId(thread.id);
  };

  // Filtered threads for the rail
  const filteredThreads = useMemo(() => {
    return threads.filter(t => {
      if (filter === 'open') return !t.resolved;
      if (filter === 'resolved') return t.resolved;
      if (filter === 'mine') return t.comments.some(c => c.author === 'you');
      return true;
    });
  }, [threads, filter]);
  const counts = useMemo(() => ({
    all: threads.length,
    open: threads.filter(t => !t.resolved).length,
    resolved: threads.filter(t => t.resolved).length,
    mine: threads.filter(t => t.comments.some(c => c.author === 'you')).length,
  }), [threads]);

  // Group threads in mermaid blocks
  const diagramThreads = (diagramId) => threads.filter(t => t.diagramId === diagramId);

  // Pin click in mermaid → focus thread
  const focusFromPin = (tid) => {
    setFocusId(tid);
    document.querySelector(`[data-thread-id="${tid}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  };

  // Wrap node-click handler to inject diagramId
  const makeNodeClicker = (diagramId, diagramRef) => (anchorId, quote, x, y) => {
    const dRect = diagramRef.current?.getBoundingClientRect();
    if (!dRect) return;
    onNodeClick(anchorId, quote, x, y, dRect, diagramId);
  };
  const d1Ref = useRef(null), d2Ref = useRef(null), d3Ref = useRef(null);

  return (
    <div className="app">
      <Topbar plan={PLAN} counts={counts}/>

      <div className="panels">
        <TOC plan={PLAN} active="2.1"/>

        <div className="doc-scroll" ref={docScrollRef} onScroll={recomputePins}>
          <article className="doc" ref={docRef}>
            {/* Gutter pins overlay */}
            {tweaks.showGutterPins && (
              <div className="gutter">
                {threads.filter(t => t.anchorKind === 'text' && pinPositions[t.id] != null && (filter === 'all' || (filter === 'open' && !t.resolved) || (filter === 'resolved' && t.resolved) || (filter === 'mine' && t.comments.some(c => c.author === 'you')))).map(t => (
                  <button
                    key={t.id}
                    className={`pin ${t.resolved ? 'resolved' : ''}`}
                    style={{ top: pinPositions[t.id] }}
                    onClick={() => jumpTo(t)}
                    title={`${t.comments.length} comment${t.comments.length > 1 ? 's' : ''} · ${t.comments[0].author}`}
                  >
                    <div className="avatar" style={{ background: window.commentHelpers.authorColor(t.comments[0].author) }}>
                      {window.commentHelpers.initials(t.comments[0].author)}
                    </div>
                    {t.comments.length > 1 && <span className="pin-badge">{t.comments.length}</span>}
                  </button>
                ))}
              </div>
            )}

            <DocBody
              d1Ref={d1Ref} d2Ref={d2Ref} d3Ref={d3Ref}
              showLegend={tweaks.showLegend}
              threads={threads}
              diagramThreads={diagramThreads}
              focusedThreadId={focusId}
              onPinClick={focusFromPin}
              makeNodeClicker={makeNodeClicker}
            />

            {/* Floating selection pill */}
            {selPill && (
              <div className="sel-pill" style={{ left: selPill.x, top: selPill.y }} onMouseDown={e => e.preventDefault()}>
                <button onClick={openTextComposer}>
                  <svg viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 9 9 0 0 1-4-.9L3 21l1.9-5.5A8.5 8.5 0 1 1 21 11.5z" stroke="currentColor" fill="none" strokeWidth="1.8"/></svg>
                  Comment
                </button>
              </div>
            )}

            {/* Composer */}
            {composer && (
              <Composer
                x={Math.max(20, composer.x)}
                y={composer.y}
                quote={composer.quote}
                kind={composer.kind}
                onSubmit={submitComment}
                onCancel={() => setComposer(null)}
              />
            )}
          </article>
        </div>

        <aside className="rail">
          <div className="rail-head">
            <h3>Comments <span className="total">{counts.all} total · {counts.open} open</span></h3>
            <RailFilters filter={filter} setFilter={setFilter} counts={counts}/>
          </div>
          <div className="rail-body">
            {filteredThreads.length === 0 ? (
              <div className="empty-state">
                <div className="glyph">␣</div>
                Nothing here yet. Select any text or click a diagram node to start a thread.
              </div>
            ) : filteredThreads.map(t => (
              <ThreadCard
                key={t.id}
                thread={t}
                isFocus={focusId === t.id}
                onFocus={setFocusId}
                onJump={jumpTo}
                onResolve={resolveThread}
                onUnresolve={unresolveThread}
                onReply={replyTo}
              />
            ))}
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

// ── Topbar ─────────────────────────────────────────────────────────
function Topbar({ plan, counts }) {
  return (
    <header className="topbar">
      <div className="tb-brand">
        <div className="tb-mark">P</div>
        <div className="tb-brand-name">plan-review</div>
      </div>
      <div className="tb-crumbs">
        <span>{plan.title}</span>
        <span className="crumb-sep">/</span>
        <span>Milestone 2</span>
        <span className="crumb-sep">/</span>
        <b>Task 2.1 · Server redirect handler</b>
        <span className="tb-status">In review</span>
      </div>
      <div className="tb-presence">
        <div className="avatar" style={{ background: 'oklch(0.60 0.16 30)' }} title="alvaro">AL</div>
        <div className="avatar" style={{ background: 'oklch(0.55 0.13 145)' }} title="maya">MA</div>
        <div className="avatar" style={{ background: 'oklch(0.58 0.14 290)' }} title="jin">JI</div>
        <div className="avatar more" title="2 more">+2</div>
      </div>
      <button className="tb-btn" title="Comments">
        <svg viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 9 9 0 0 1-4-.9L3 21l1.9-5.5A8.5 8.5 0 1 1 21 11.5z"/></svg>
        {counts.open}
      </button>
      <button className="tb-btn primary">Submit review</button>
    </header>
  );
}

// ── TOC ────────────────────────────────────────────────────────────
function TOC({ plan, active }) {
  return (
    <aside className="toc">
      <div className="toc-header">
        <span className="grow">Plan outline</span>
        <span className="count">8 tasks</span>
      </div>
      {plan.milestones.map(m => (
        <div key={m.id} className="toc-milestone">
          <div className="toc-mile-head">
            <span>{m.name}</span>
            <span className="toc-mile-bar"><i style={{ width: `${m.progress * 100}%` }}/></span>
          </div>
          {m.tasks.map(t => (
            <a key={t.id} href={`#${t.id}`} className={`toc-item ${active === t.id ? 'active' : ''}`}>
              <span className="toc-num">{t.id}</span>
              <span className={`toc-dot ${t.active ? 'active' : t.done ? 'done' : 'todo'}`}/>
              <span>{t.name}</span>
              {t.comments > 0 && <span className="toc-comment-pip">{t.comments}</span>}
            </a>
          ))}
        </div>
      ))}
    </aside>
  );
}

// ── Tweaks panel ───────────────────────────────────────────────────
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
          <label className="lab">Density</label>
          <div className="tw-seg">
            {['comfortable', 'compact'].map(k => (
              <button key={k} className={tweaks.density === k ? 'on' : ''} onClick={() => setTweak('density', k)}>{k}</button>
            ))}
          </div>
        </div>
        <div className="tw-row">
          <label className="tw-check">
            <input type="checkbox" checked={tweaks.showGutterPins} onChange={e => setTweak('showGutterPins', e.target.checked)}/>
            Show comment pins in the gutter
          </label>
          <label className="tw-check">
            <input type="checkbox" checked={tweaks.showLegend} onChange={e => setTweak('showLegend', e.target.checked)}/>
            Show legend on diagrams
          </label>
        </div>
      </div>
    </div>
  );
}

// ── The document body ─────────────────────────────────────────────
function DocBody({ d1Ref, d2Ref, d3Ref, showLegend, diagramThreads, makeNodeClicker, onPinClick, focusedThreadId }) {
  return (
    <>
      <div className="doc-eyebrow">
        <span>Milestone 2 · Implementation</span>
        <span className="pill">Task 2.1</span>
        <span className="pill">Assigned · you</span>
        <span className="pill">Owner · @alvaro</span>
      </div>
      <h1 className="doc-title">Server redirect handler for OAuth2 PKCE</h1>
      <p className="doc-subtitle">
        Receive the authorization code, exchange it for tokens, and establish a session — without the legacy callback dance.
      </p>

      <dl className="defs">
        <dt>Depends on</dt><dd><code>1.2 · Map call sites</code></dd>
        <dt>Blocks</dt><dd><code>2.2 · Client PKCE challenge</code>, <code>2.3 · Token refresh loop</code></dd>
        <dt>Verification</dt><dd>Integration test suite + staging shadow traffic for 48h</dd>
        <dt>Target</dt><dd>Cutover the week of <b>May 26</b></dd>
      </dl>

      <h2 id="overview"><span className="h2-num">01</span>Overview</h2>
      <p data-paraid="p-overview" data-section="§ Overview">
        The current auth path uses an opaque session cookie set after a server-rendered login form. We're replacing it with the OAuth2 <strong>authorization code flow with PKCE</strong> — the recommended pattern for browser clients since RFC 7636. The redirect handler is the bridge: it receives the code, performs the token exchange, and hands the user a fresh session. This task scope is just the server piece — the client-side challenge generator is task 2.2.
        We're paying particular attention to <em>circuit-breaker behaviour when the upstream Auth server is slow</em>; the current flow has no timeouts and we've taken outages in the past from that alone.
      </p>

      <div className="callout info">
        <span className="ico">i</span>
        <div className="body">
          <b>Why PKCE.</b> Without PKCE, an attacker who intercepts the redirect URL can exchange the code themselves. The <code>code_verifier</code> binds the exchange to the original client and is never transmitted in the initial redirect.
        </div>
      </div>

      <h2 id="goals"><span className="h2-num">02</span>Goals</h2>
      <ul data-paraid="p-goals" data-section="§ Goals">
        <li><b>One round-trip cutover</b> — flip the flag, every new login uses PKCE; in-flight sessions keep working until natural expiry.</li>
        <li><b>No silent retries</b> on malformed PKCE requests. We log and fail with a 400.</li>
        <li><b>Backwards-compat redirect URLs</b> — the existing <code>/auth/callback</code> path keeps working through the migration window.</li>
        <li><b>Observable</b> — every state transition emits a metric; SLO is &lt; 200ms p99 for the token exchange.</li>
      </ul>

      <h2 id="architecture"><span className="h2-num">03</span>Request flow</h2>
      <p data-paraid="p-arch" data-section="§ Request flow">
        At runtime, every incoming request hits the auth middleware before the route handler. The middleware checks for a valid access token, attempts a refresh if there's a refresh token on the session, and falls through to the redirect handler if neither is present. The decision tree is below — the diamond nodes are what we need integration tests around.
      </p>

      <div id="d-auth" ref={d1Ref}>
        <MermaidBlock
          source={FLOW_AUTH}
          title="Request authentication flow"
          showLegend={showLegend}
          threads={diagramThreads('d-auth')}
          onNodeClick={makeNodeClicker('d-auth', d1Ref)}
          onPinClick={onPinClick}
          focusedThreadId={focusedThreadId}
        />
      </div>

      <div className="callout warn">
        <span className="ico">!</span>
        <div className="body">
          <b>Redirect loop risk.</b> If the refresh endpoint returns a 5xx, the current draft routes back to <code>/login</code> — which then tries to refresh again. We need an explicit circuit-break here; see the open thread on this from @alvaro.
        </div>
      </div>

      <h2 id="handshake"><span className="h2-num">04</span>Token exchange</h2>
      <p data-paraid="p-pkce-intro" data-section="§ Token exchange">
        The handshake between browser, client, auth server, and API is standard OAuth2 PKCE. The <strong>code_verifier</strong> is generated client-side, never leaves the client, and is presented to the auth server only at the token exchange step — proving the same client that started the flow is finishing it.
      </p>

      <div id="d-pkce" ref={d2Ref}>
        <MermaidBlock
          source={SEQ_PKCE}
          title="PKCE token exchange"
          showLegend={showLegend}
          threads={diagramThreads('d-pkce')}
          onNodeClick={makeNodeClicker('d-pkce', d2Ref)}
          onPinClick={onPinClick}
        />
      </div>

      <h3>Token storage</h3>
      <p data-paraid="p-storage" data-section="§ Token storage">
        Access tokens are kept in memory only; refresh tokens go into an <code>HttpOnly; Secure; SameSite=Lax</code> cookie scoped to <code>/oauth</code>. The session cookie continues to identify the user for legacy routes during the transition.
      </p>

      <pre className="code-block" dangerouslySetInnerHTML={{ __html: CODE_HANDLER_HTML }} />

      <h2 id="edge-cases"><span className="h2-num">05</span>Edge cases</h2>
      <p data-paraid="p-error-edge" data-section="§ Edge cases">
        If the client hits <code>/authorize</code> without generating a verifier first — usually because of a stale tab or a misconfigured embed — we should <strong>fail fast rather than silently retry</strong>. A bounce back to login without surfacing the cause has burned us before.
      </p>

      <div id="d-verifier" ref={d3Ref}>
        <MermaidBlock
          source={FLOW_VERIFIER}
          title="Verifier guard"
          showLegend={showLegend}
          threads={diagramThreads('d-verifier')}
          onNodeClick={makeNodeClicker('d-verifier', d3Ref)}
          onPinClick={onPinClick}
        />
      </div>

      <h2 id="rollout"><span className="h2-num">06</span>Rollout</h2>
      <table data-paraid="p-rollout" data-section="§ Rollout">
        <thead><tr><th>Stage</th><th>Audience</th><th>Duration</th><th>Rollback</th></tr></thead>
        <tbody>
          <tr><td>Shadow</td><td>0% live traffic — mirror only</td><td>3 days</td><td>Flag off (instant)</td></tr>
          <tr><td>Canary</td><td>5% of new sessions, internal users first</td><td>2 days</td><td>Flag off + invalidate canary cookies</td></tr>
          <tr><td>Ramp</td><td>25% → 50% → 100% over 48h</td><td>2 days</td><td>Flag pinned to last stable ramp</td></tr>
          <tr><td>Cleanup</td><td>Legacy path returns 410 Gone</td><td>—</td><td>—</td></tr>
        </tbody>
      </table>

      <div className="callout success">
        <span className="ico">✓</span>
        <div className="body">
          <b>Ready for review.</b> Once the open threads above are resolved and the integration tests are green on the <code>oauth-pkce</code> branch, this task is ready to merge behind the <code>auth.pkce.enabled</code> flag.
        </div>
      </div>
    </>
  );
}

// Inject Google Fonts dynamically (Geist + Newsreader)
(function loadFonts() {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500&family=Newsreader:ital,wght@0,400;0,500;0,600;1,400;1,500&display=swap';
  document.head.appendChild(link);
})();

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
