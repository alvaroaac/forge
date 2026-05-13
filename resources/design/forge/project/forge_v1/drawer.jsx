// Forge v1.0 — Spec drawer with inline comment threads + per-section regenerate
const { useState: useStateDrawer, useEffect: useEffectDrawer, useRef: useRefDrawer } = React;

// Highlight `code`, §refs, @mentions, [added] markers inline
function highlightInline(s) {
  return s
    .replace(/`([^`]+)`/g, '<code class="md-code">$1</code>')
    .replace(/(§\d+(?:\.\d+)?)/g, '<span class="md-ref">$1</span>')
    .replace(/@(\w+)/g, '<span class="md-mention">@$1</span>')
    .replace(/\[added\]/g, '<span class="md-added">[added]</span>');
}

function MarkdownBlock({ children, hasThread, threadCount, onComment, onRegen }) {
  const [hover, setHover] = useStateDrawer(false);
  return (
    <div
      className={`md-block ${hasThread ? "md-block-thread" : ""}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div className="md-block-body">{children}</div>
      <div className={`md-block-tools ${hover || hasThread ? "md-block-tools-shown" : ""}`}>
        <button className="md-tool" onClick={onRegen} title="Regenerate this section">
          <IconRegen size={11} stroke={1.7} />
        </button>
        <button
          className={`md-tool ${hasThread ? "md-tool-active" : ""}`}
          onClick={onComment}
          title={hasThread ? `${threadCount} thread${threadCount > 1 ? "s" : ""}` : "Add comment"}
        >
          <IconChat size={11} stroke={1.7} />
          {hasThread && <span className="md-tool-badge mono">{threadCount}</span>}
        </button>
      </div>
    </div>
  );
}

function ThreadBubble({ thread, onResolve, onReply }) {
  const [reply, setReply] = useStateDrawer("");
  return (
    <div className={`thread ${thread.resolved ? "thread-resolved" : ""}`}>
      <div className="thread-head mono">
        <IconChat size={10} stroke={2} />
        <span>thread</span>
        <span className="dim">·</span>
        <span className="dim">{thread.history.length} messages</span>
        <span style={{ flex: 1 }} />
        {thread.resolved
          ? <span className="thread-status mono" style={{ color: "var(--ok)" }}>
              <IconCheck size={9} stroke={2.4} /> resolved
            </span>
          : <button className="btn-ghost btn-ghost-mini" onClick={onResolve}>
              <IconCheck size={9} stroke={2} /> resolve
            </button>
        }
      </div>
      <div className="thread-history">
        {thread.history.map((m, i) => (
          <div key={i} className={`thread-msg ${m.author === "claude" ? "thread-msg-ai" : "thread-msg-user"}`}>
            <div className="thread-msg-head mono">
              <span className={`thread-author ${m.author === "claude" ? "thread-author-ai" : ""}`}>
                {m.author === "claude" ? <IconSpark size={9} stroke={2} /> : null}
                @{m.author}
              </span>
              <span className="dim">{m.ts}</span>
            </div>
            <div className="thread-msg-body">{m.text}</div>
          </div>
        ))}
      </div>
      {!thread.resolved && (
        <div className="thread-reply">
          <input
            className="thread-reply-input mono"
            placeholder="Reply… (⏎ to send to Claude)"
            value={reply}
            onChange={e => setReply(e.target.value)}
          />
          <button className="btn-ghost btn-ghost-mini">send</button>
        </div>
      )}
    </div>
  );
}

function MarkdownSection({ section, expanded, onToggleThread, onResolveThread, onRegen }) {
  const lines = section.body.split("\n");
  const threads = section.threads || [];
  const showThreads = expanded && threads.length > 0;
  return (
    <section className="md-section" id={`sec-${section.id}`}>
      <div className="md-section-head">
        <h3 className="md-h">
          <span className="md-h-anchor mono dim">§</span>
          {section.h}
        </h3>
        {threads.length > 0 && (
          <span className="md-thread-pill mono" onClick={() => onToggleThread(section.id)}>
            <IconChat size={9} stroke={2} />
            {threads.filter(t => !t.resolved).length} open
          </span>
        )}
      </div>
      <MarkdownBlock
        hasThread={threads.length > 0}
        threadCount={threads.length}
        onComment={() => onToggleThread(section.id)}
        onRegen={() => onRegen(section.id)}
      >
        {lines.map((line, i) => {
          const trimmed = line.trim();
          if (!trimmed) return null;
          const isBullet = /^[•\-*]\s/.test(trimmed);
          const isNum = /^\d+\.\s/.test(trimmed);
          if (isBullet || isNum) {
            const text = trimmed.replace(/^[•\-*]\s+/, "").replace(/^\d+\.\s+/, "");
            const idx = isNum ? trimmed.match(/^(\d+)/)[1] : "•";
            return (
              <div className="md-li" key={i}>
                <span className="md-li-mark mono">{isNum ? `${idx}.` : "•"}</span>
                <span dangerouslySetInnerHTML={{ __html: highlightInline(text) }} />
              </div>
            );
          }
          return <p key={i} dangerouslySetInnerHTML={{ __html: highlightInline(trimmed) }} />;
        })}
      </MarkdownBlock>
      {showThreads && (
        <div className="md-threads">
          {threads.map(t => (
            <ThreadBubble key={t.id} thread={t} onResolve={() => onResolveThread(section.id, t.id)} />
          ))}
        </div>
      )}
    </section>
  );
}

function DetailTab({ issue, spec }) {
  if (!spec) {
    return (
      <div className="drawer-empty">
        <div className="mono dim">No Linear detail cached for {issue.id}.</div>
      </div>
    );
  }
  return (
    <div className="detail-tab">
      <section className="md-section">
        <h3 className="md-h">Description</h3>
        <div className="md-body">
          {spec.description.split("\n\n").map((p, i) => (
            <p key={i} dangerouslySetInnerHTML={{ __html: highlightInline(p.replace(/\n/g, " ")) }} />
          ))}
        </div>
      </section>

      <section className="md-section">
        <h3 className="md-h">
          Comments
          <span className="mono dim" style={{ fontWeight: 400, marginLeft: 6 }}>
            ({spec.comments.length})
          </span>
        </h3>
        <div className="comments">
          {spec.comments.map((c, i) => (
            <div className="comment" key={i}>
              <div className="comment-head">
                <span className="comment-author mono">@{c.author}</span>
                <span className="mono dim">{c.ts}</span>
              </div>
              <div className="comment-body">{c.text}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function SpecTab({ issue, spec }) {
  const [approved, setApproved] = useStateDrawer(issue.specStatus === "approved");
  const [openSections, setOpenSections] = useStateDrawer(() => {
    const set = new Set();
    if (spec) spec.spec.sections.forEach(s => { if ((s.threads || []).length) set.add(s.id); });
    return set;
  });
  const [resolved, setResolved] = useStateDrawer({});
  const [regenning, setRegenning] = useStateDrawer(null);

  useEffectDrawer(() => {
    setApproved(issue.specStatus === "approved");
    const set = new Set();
    if (spec) spec.spec.sections.forEach(s => { if ((s.threads || []).length) set.add(s.id); });
    setOpenSections(set);
    setResolved({});
  }, [issue.id]);

  if (!spec) {
    return (
      <div className="drawer-empty">
        <div style={{ marginBottom: 16, color: "var(--text-2)" }}>
          No spec yet for <span className="mono" style={{ color: "var(--text-1)" }}>{issue.id}</span>.
        </div>
        <button className="btn-primary">
          <IconSpark size={12} stroke={2} /> Generate Spec
        </button>
        <div className="mono dim" style={{ marginTop: 14, fontSize: 11 }}>
          reads CLAUDE.md + thoughts/ + Linear issue
        </div>
      </div>
    );
  }

  const sections = spec.spec.sections.map(s => ({
    ...s,
    threads: (s.threads || []).map(t => ({ ...t, resolved: resolved[`${s.id}/${t.id}`] ?? t.resolved })),
  }));

  const openThreads = sections.reduce((n, s) => n + (s.threads || []).filter(t => !t.resolved).length, 0);
  const meta = spec.spec.meta;

  const toggleThread = (sid) => setOpenSections(prev => {
    const next = new Set(prev);
    next.has(sid) ? next.delete(sid) : next.add(sid);
    return next;
  });
  const resolveThread = (sid, tid) =>
    setResolved(r => ({ ...r, [`${sid}/${tid}`]: true }));
  const onRegen = (sid) => {
    setRegenning(sid);
    setTimeout(() => setRegenning(null), 1800);
  };

  return (
    <div className="spec-tab">
      <div className="spec-meta-strip">
        <span className="mono dim">{meta.path}</span>
        <span className="mono dim">·</span>
        <span className="mono dim">{meta.lines} lines</span>
        <span className="mono dim">·</span>
        <span className="mono dim">generated {meta.generated}</span>
        <span style={{ flex: 1 }} />
        <span className="mono dim" title="Tokens used to generate">
          <IconCpu size={9} stroke={1.7} /> {meta.model} · {meta.tokens}
        </span>
      </div>

      {openThreads > 0 && (
        <div className="spec-thread-bar mono">
          <IconChat size={11} stroke={2} />
          <span>{openThreads} open thread{openThreads > 1 ? "s" : ""}</span>
          <span className="dim">— submit to regenerate the full spec</span>
          <span style={{ flex: 1 }} />
          <button className="btn-ghost btn-ghost-accent">
            <IconRegen size={10} stroke={2} /> Submit & regenerate
          </button>
        </div>
      )}

      <div className="spec-scroll">
        {sections.map(s => (
          <div key={s.id} className={regenning === s.id ? "section-regenning" : ""}>
            <MarkdownSection
              section={s}
              expanded={openSections.has(s.id)}
              onToggleThread={toggleThread}
              onResolveThread={resolveThread}
              onRegen={onRegen}
            />
          </div>
        ))}
      </div>

      <div className="spec-foot">
        <div className="spec-foot-row">
          <button className="btn-ghost">
            <IconEdit size={11} stroke={2} /> Open in editor
          </button>
          <span style={{ flex: 1 }} />
          <button
            className={`btn-primary ${approved ? "btn-primary-done" : ""}`}
            onClick={() => setApproved(true)}
          >
            <IconCheck size={12} stroke={2} />
            {approved ? "Spec Approved" : "Approve Spec"}
          </button>
        </div>
        <div className="spec-launch-row">
          <button className={`launch-btn ${!approved ? "launch-disabled" : ""}`} disabled={!approved}>
            <IconSpark size={12} stroke={2} />
            <span>Launch <strong>Claude Code</strong></span>
            <span className="mono dim launch-kbd">⌘⏎</span>
          </button>
          <button className={`launch-btn ${!approved ? "launch-disabled" : ""}`} disabled={!approved}>
            <IconTerminal size={12} stroke={2} />
            <span>Launch <strong>Codex</strong></span>
            <span className="mono dim launch-kbd">⌘⇧⏎</span>
          </button>
          <button className={`launch-btn launch-orch ${!approved ? "launch-disabled" : ""}`} disabled={!approved}>
            <IconOrch size={12} stroke={2} />
            <span>Run <strong>Orchestrator</strong></span>
            <span className="mono dim launch-kbd">⌘⇧O</span>
          </button>
        </div>
        {!approved && (
          <div className="mono dim" style={{ textAlign: "center", marginTop: 10, fontSize: 11 }}>
            agents unlock after approval
          </div>
        )}
      </div>
    </div>
  );
}

function SpecDrawer({ issue, tab, setTab, onClose }) {
  const open = !!issue;
  const data = window.FORGE_DATA;
  const spec = issue ? data.specs[issue.id] : null;
  const g = issue ? (groupMeta[issue.group] || groupMeta.Chore) : null;

  return (
    <>
      <div className={`drawer-scrim ${open ? "drawer-scrim-open" : ""}`} onClick={onClose} />
      <aside className={`drawer ${open ? "drawer-open" : ""}`}>
        {issue && (
          <>
            <div className="drawer-head" style={{ borderLeftColor: g.color }}>
              <div className="drawer-head-row1">
                <span className="mono drawer-id">{issue.id}</span>
                <span className="drawer-title">{issue.title}</span>
                <button className="icon-btn" onClick={onClose} title="Close (Esc)">
                  <IconClose size={14} />
                </button>
              </div>
              <div className="drawer-head-row2">
                <span className="chip" style={{ color: g.color }}>
                  <g.Icon size={10} stroke={2} /> {issue.group}
                </span>
                <PriorityChip priority={issue.priority} />
                <LabelBadge label={issue.label} />
                <span className="mono dim" style={{ marginLeft: 4 }}>
                  · {issue.status.replace("-", " ")}
                </span>
                <span style={{ flex: 1 }} />
                <button className="btn-ghost">
                  Linear <IconExternal size={10} stroke={2} />
                </button>
              </div>
              <div className="drawer-tabs">
                <button
                  className={`drawer-tab ${tab === "detail" ? "drawer-tab-active" : ""}`}
                  onClick={() => setTab("detail")}
                >
                  Detail
                </button>
                <button
                  className={`drawer-tab ${tab === "spec" ? "drawer-tab-active" : ""}`}
                  onClick={() => setTab("spec")}
                >
                  Spec
                  {issue.specStatus !== "none" && (
                    <StatusDot state={issue.specStatus === "approved" ? "connected" : "review"} size={5} />
                  )}
                </button>
              </div>
            </div>

            <div className="drawer-body">
              {tab === "detail"
                ? <DetailTab issue={issue} spec={spec} />
                : <SpecTab issue={issue} spec={spec} />
              }
            </div>
          </>
        )}
      </aside>
    </>
  );
}

window.SpecDrawer = SpecDrawer;
