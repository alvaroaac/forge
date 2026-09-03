/* global React */
const { useState, useRef, useEffect } = React;

// ── Avatar palette by author ─────────────────────────────────────────
const AUTHOR_COLORS = {
  you:    'oklch(0.52 0.16 255)',
  alvaro: 'oklch(0.60 0.16 30)',
  maya:   'oklch(0.55 0.13 145)',
  jin:    'oklch(0.58 0.14 290)',
  rin:    'oklch(0.62 0.14 75)',
};
function authorColor(name) {
  return AUTHOR_COLORS[name?.toLowerCase()] || 'oklch(0.50 0.04 260)';
}
function initials(name) {
  if (!name) return '?';
  return name.split(/\s+/).slice(0, 2).map(s => s[0]).join('').toUpperCase();
}
function fmtTime(ts) {
  const d = (Date.now() - ts) / 1000;
  if (d < 60) return 'just now';
  if (d < 3600) return Math.floor(d / 60) + 'm';
  if (d < 86400) return Math.floor(d / 3600) + 'h';
  return Math.floor(d / 86400) + 'd';
}

// Format comment text — bold @mentions, keep plain otherwise
function formatBody(text) {
  const parts = [];
  const re = /(@[A-Za-z][A-Za-z0-9_]*)/g;
  let last = 0, m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push(<span key={m.index} className="mention">{m[1]}</span>);
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

// ── Icons ───────────────────────────────────────────────────────────
const CI = {
  Check:   () => (<svg viewBox="0 0 24 24"><path d="m5 12 5 5L20 7"/></svg>),
  Undo:    () => (<svg viewBox="0 0 24 24"><path d="M3 7v6h6M3 13a9 9 0 1 0 3-7"/></svg>),
  Reply:   () => (<svg viewBox="0 0 24 24"><path d="M9 14l-5-5 5-5M4 9h10a6 6 0 0 1 6 6v3"/></svg>),
  Send:    () => (<svg viewBox="0 0 24 24"><path d="M3 12 21 3l-9 18-2-7-7-2z"/></svg>),
  Comment: () => (<svg viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 9 9 0 0 1-4-.9L3 21l1.9-5.5A8.5 8.5 0 1 1 21 11.5z"/></svg>),
  Filter:  () => (<svg viewBox="0 0 24 24"><path d="M4 6h16M7 12h10M10 18h4"/></svg>),
  Trash:   () => (<svg viewBox="0 0 24 24"><path d="M4 7h16M10 7V4h4v3M6 7l1 13h10l1-13"/></svg>),
};

// ── A single comment row ────────────────────────────────────────────
function CommentRow({ c }) {
  return (
    <div className="comment-row">
      <div className="avatar" style={{ background: authorColor(c.author) }}>{initials(c.author)}</div>
      <div className="col">
        <div className="who">
          <b>{c.author}</b>
          <time>{fmtTime(c.ts)}</time>
        </div>
        <div className="comment-text">{formatBody(c.body)}</div>
      </div>
    </div>
  );
}

// ── Anchor header inside a thread ───────────────────────────────────
function AnchorHeader({ thread, onJump }) {
  const k = thread.anchorKind || 'text';
  return (
    <div className="thread-anchor">
      <span className={`kind ${k}`}>{k}</span>
      <span className="loc" onClick={onJump} style={{ cursor: 'pointer' }}>{thread.loc}</span>
      <span className="spacer"/>
      {thread.resolved && (
        <span className="resolved-badge"><CI.Check/> Resolved</span>
      )}
    </div>
  );
}

// ── Thread card ─────────────────────────────────────────────────────
function ThreadCard({ thread, isFocus, onFocus, onJump, onResolve, onUnresolve, onReply, onDelete }) {
  const [reply, setReply] = useState('');
  const [showReply, setShowReply] = useState(false);
  const inputRef = useRef(null);
  useEffect(() => { if (showReply) setTimeout(() => inputRef.current?.focus(), 30); }, [showReply]);

  const submit = () => {
    if (!reply.trim()) return;
    onReply(thread.id, reply.trim());
    setReply('');
    setShowReply(false);
  };

  return (
    <div
      className={`thread ${thread.resolved ? 'resolved' : ''} ${isFocus ? 'is-focus' : ''}`}
      onClick={() => onFocus(thread.id)}
      data-thread-id={thread.id}
    >
      <AnchorHeader thread={thread} onJump={() => onJump(thread)} />
      {thread.quote && <div className="thread-quote">"{thread.quote}"</div>}
      {thread.comments.map((c, i) => <CommentRow key={i} c={c} />)}

      {showReply ? (
        <div className="reply-row" onClick={e => e.stopPropagation()}>
          <div className="avatar" style={{ background: authorColor('you') }}>YO</div>
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
          <button className="send" onClick={submit} disabled={!reply.trim()}><CI.Send/></button>
        </div>
      ) : (
        <div className="thread-actions" onClick={e => e.stopPropagation()}>
          {!thread.resolved && (
            <button onClick={() => setShowReply(true)}><CI.Reply/> Reply</button>
          )}
          <span className="spacer"/>
          {!thread.resolved ? (
            <button className="resolve" onClick={() => onResolve(thread.id)}><CI.Check/> Resolve</button>
          ) : (
            <button className="unresolve" onClick={() => onUnresolve(thread.id)}><CI.Undo/> Reopen</button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Filter rail header ──────────────────────────────────────────────
function RailFilters({ filter, setFilter, counts }) {
  const F = [
    { k: 'open',     label: 'Open',     n: counts.open },
    { k: 'all',      label: 'All',      n: counts.all },
    { k: 'mine',     label: 'Mine',     n: counts.mine },
    { k: 'resolved', label: 'Resolved', n: counts.resolved },
  ];
  return (
    <div className="rail-filters">
      {F.map(f => (
        <button key={f.k} className={filter === f.k ? 'on' : ''} onClick={() => setFilter(f.k)}>
          {f.label}<span className="pip">{f.n}</span>
        </button>
      ))}
    </div>
  );
}

// ── The composer card (used for selection AND node clicks) ─────────
function Composer({ x, y, quote, kind, onSubmit, onCancel, placeholder }) {
  const [text, setText] = useState('');
  const ref = useRef(null);
  useEffect(() => { setTimeout(() => ref.current?.focus(), 30); }, []);
  const submit = () => {
    if (!text.trim()) return;
    onSubmit(text.trim());
  };
  return (
    <div className="composer-card" style={{ left: x, top: y }} onClick={e => e.stopPropagation()}>
      {quote && <div className="quote">{quote}</div>}
      <textarea
        ref={ref}
        placeholder={placeholder || 'Type a comment… use @ to mention'}
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit();
          if (e.key === 'Escape') onCancel();
        }}
      />
      <div className="row">
        <span className="hint">⌘⏎ to send</span>
        <span className="spacer"/>
        <button onClick={onCancel}>Cancel</button>
        <button className="primary" onClick={submit} disabled={!text.trim()}>Comment</button>
      </div>
    </div>
  );
}

window.ThreadCard = ThreadCard;
window.RailFilters = RailFilters;
window.Composer = Composer;
window.commentHelpers = { authorColor, initials, fmtTime, formatBody };
