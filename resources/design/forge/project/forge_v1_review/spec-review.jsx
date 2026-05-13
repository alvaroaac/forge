// Forge — Spec Review screen
// Owns the full-window spec review: top bar, rail, read/edit/split modes,
// inline comment threads, status bar.

const { useState: useStateR, useMemo: useMemoR, useEffect: useEffectR, useRef: useRefR, Fragment: FragmentR } = React;

// ── Markdown parsing ────────────────────────────────────────────────────────
// We control the source so we don't need a full markdown lib. Split into
// front-matter (H1 + blockquote + hr) and ## sections; the rest is a small
// per-line classifier.

function parseSpec(source) {
  const lines = source.split("\n");
  const out = { title: "", frontmatter: [], sections: [] };
  let i = 0;
  if (lines[0]?.startsWith("# ")) {
    out.title = lines[0].slice(2);
    i = 1;
  }
  // collect blockquote lines until first ---
  while (i < lines.length) {
    const l = lines[i];
    if (l.startsWith("## ")) break;
    if (l.startsWith("> ")) out.frontmatter.push(l.slice(2));
    i++;
  }
  // sections
  let current = null;
  for (; i < lines.length; i++) {
    const l = lines[i];
    if (l.startsWith("## ")) {
      if (current) out.sections.push(current);
      const h = l.slice(3);
      current = { id: slug(h), h, body: [] };
    } else if (current) {
      if (l === "---") continue; // drop section dividers, we render our own
      current.body.push(l);
    }
  }
  if (current) out.sections.push(current);
  return out;
}

function slug(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

// Tokenise inline code spans, [added] markers, and bare URLs
function renderInline(s) {
  // escape angle brackets first
  let h = s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  h = h.replace(/`([^`]+)`/g, '<code class="rv-code-inline">$1</code>');
  h = h.replace(/\[added\]/g, '<span class="rv-added-tag">added</span>');
  h = h.replace(/(https?:\/\/[^\s)]+)/g, '<a href="$1" class="tok-link">$1</a>');
  return h;
}

// ── Editor: token a single source line for syntax tinting ─────────────────
function tintLine(line) {
  if (line === "") return { className: "", html: "&nbsp;" };
  if (line.startsWith("# ")) return wrap("tok-h1", line);
  if (line.startsWith("## ")) return wrap("tok-h2", line);
  if (line.startsWith("### ")) return wrap("tok-h3", line);
  if (line.startsWith("> ")) return wrap("tok-quote", line);
  if (line === "---") return wrap("tok-hr", line);
  // numbered list
  const num = line.match(/^(\s*)(\d+)\.\s/);
  if (num) {
    const rest = line.slice(num[0].length);
    return {
      className: "",
      html: `${num[1]}<span class="tok-num">${num[2]}.</span> ${tintInline(rest)}`,
    };
  }
  // bullet
  const bull = line.match(/^(\s*)-\s/);
  if (bull) {
    const rest = line.slice(bull[0].length);
    return {
      className: "",
      html: `${bull[1]}<span class="tok-bull">-</span> ${tintInline(rest)}`,
    };
  }
  return { className: "", html: tintInline(line) };
}

function tintInline(s) {
  let h = esc(s);
  h = h.replace(/`([^`]+)`/g, '<span class="tok-code">`$1`</span>');
  h = h.replace(/\[added\]/g, '<span class="tok-added">[added]</span>');
  h = h.replace(/(§\d+(?:\.\d+)?)/g, '<span class="tok-mark">$1</span>');
  h = h.replace(/(https?:\/\/[^\s)]+)/g, '<span class="tok-link">$1</span>');
  return h;
}

function esc(s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

function wrap(cls, line) {
  return { className: cls, html: esc(line) };
}

// ── Top bar ────────────────────────────────────────────────────────────────
function TopBar({ data, view, onView, openThreads, onApprove, approved }) {
  return (
    <div className="rv-topbar">
      <div className="rv-breadcrumb">
        <button className="rv-back" title="Back to dashboard (Esc)">
          <Icon size={12} stroke={2}><path d="M9 3l-5 5 5 5" /><path d="M4 8h10" /></Icon>
          Back
        </button>
        <span className="rv-bc-sep">/</span>
        <span className="rv-bc-id mono">{data.issue.id}</span>
        <span className="rv-bc-title">{data.issue.title}</span>
        <span className="rv-bc-sep">·</span>
        <span className="rv-bc-here">
          <IconEdit size={11} stroke={2} />
          Spec Review
        </span>
      </div>

      <div className="rv-segm">
        <button
          className={`rv-segm-btn ${view === "read" ? "rv-segm-btn-active" : ""}`}
          onClick={() => onView("read")}
        >
          <IconBook size={11} stroke={1.8} /> Read
        </button>
        <button
          className={`rv-segm-btn ${view === "split" ? "rv-segm-btn-active" : ""}`}
          onClick={() => onView("split")}
        >
          <Icon size={11} stroke={1.8}><path d="M8 2v12M2 2h12v12H2z" /></Icon>
          Split
        </button>
        <button
          className={`rv-segm-btn ${view === "edit" ? "rv-segm-btn-active" : ""}`}
          onClick={() => onView("edit")}
        >
          <IconEdit size={11} stroke={1.8} /> Edit
        </button>
      </div>

      <div className="rv-topbar-right">
        <button className="btn-ghost">
          <IconRegen size={11} stroke={1.8} />
          Regenerate all
        </button>
        <button className="btn-submit">
          <IconChat size={11} stroke={1.8} />
          Submit comments
          {openThreads > 0 && <span className="btn-submit-count mono">{openThreads}</span>}
          <span className="btn-submit-kbd mono">⌘⇧↵</span>
        </button>
        <button className="btn-approve" onClick={onApprove}>
          <IconCheck size={11} stroke={2.2} />
          {approved ? "Approved" : "Approve"}
          <span className="btn-approve-kbd mono">⌘↵</span>
        </button>
      </div>
    </div>
  );
}

// ── Sub bar ────────────────────────────────────────────────────────────────
function SubBar({ data, openThreads, view, onJumpToFirstThread }) {
  return (
    <div className="rv-subbar">
      <span className="rv-subbar-path">
        <IconFolder size={11} stroke={1.6} />
        {data.spec.path}
      </span>
      <span className="rv-subbar-sep">·</span>
      <span className="mono dim">{data.spec.lines} lines</span>
      <span className="rv-subbar-sep">·</span>
      <span className="rv-subbar-dirty mono">
        <span className="dot" />
        <span style={{ color: "var(--text-2)" }}>saved {data.spec.savedAt}</span>
      </span>
      <span className="rv-subbar-sep">·</span>
      <span className="mono dim">{data.spec.model}</span>

      <span className="rv-subbar-spacer" />

      {openThreads > 0 && (
        <button className="rv-subbar-pill rv-subbar-threads" onClick={onJumpToFirstThread}>
          <IconChat size={10} stroke={2} />
          <span className="mono">{openThreads} open thread{openThreads > 1 ? "s" : ""}</span>
        </button>
      )}
      <button className="rv-subbar-pill">
        <IconExternal size={10} stroke={1.8} />
        <span className="mono">Linear</span>
      </button>
      <button className="rv-subbar-pill">
        <Icon size={10} stroke={1.8}><path d="M4 4h8v8H4z" /><path d="M2 8h2M12 8h2M8 2v2M8 12v2" /></Icon>
        <span className="mono">Diff</span>
      </button>
    </div>
  );
}

// ── Left rail ──────────────────────────────────────────────────────────────
function Rail({ data, parsed, activeSection, onSection, allThreadCounts, totalThreads }) {
  return (
    <div className="rv-rail">
      <div className="rail-section">
        <div className="rail-h">
          Outline
          <span className="rail-h-count mono">{parsed.sections.length}</span>
        </div>
        <div className="toc-list">
          {parsed.sections.map((s, i) => {
            const tc = allThreadCounts[s.id] || 0;
            const active = activeSection === s.id;
            return (
              <div
                key={s.id}
                className={`toc-item ${active ? "toc-item-active" : ""}`}
                onClick={() => onSection(s.id)}
              >
                <span className="toc-num mono">§{i + 1}</span>
                <span className="toc-title">{s.h}</span>
                {tc > 0 ? <span className="toc-badge mono">{tc}</span> : <span />}
              </div>
            );
          })}
        </div>
      </div>

      <div className="rail-section">
        <div className="rail-h">Metadata</div>
        <div className="rail-meta">
          <div className="rail-meta-row">
            <span className="rail-meta-k">issue</span>
            <span className="rail-meta-v">{data.issue.id}</span>
          </div>
          <div className="rail-meta-row">
            <span className="rail-meta-k">priority</span>
            <span className="rail-meta-v priority-urgent">urgent</span>
          </div>
          <div className="rail-meta-row">
            <span className="rail-meta-k">label</span>
            <span className="rail-meta-v"><span className="label-pill">auth</span></span>
          </div>
          <div className="rail-meta-row">
            <span className="rail-meta-k">model</span>
            <span className="rail-meta-v">{data.spec.model}</span>
          </div>
          <div className="rail-meta-row">
            <span className="rail-meta-k">tokens</span>
            <span className="rail-meta-v">{data.spec.tokens}</span>
          </div>
          <div className="rail-meta-row">
            <span className="rail-meta-k">threads</span>
            <span className="rail-meta-v" style={{ color: totalThreads ? "var(--warn)" : "var(--text-2)" }}>{totalThreads} open</span>
          </div>
        </div>
      </div>

      <div className="rail-section">
        <div className="rail-h">Recent edits</div>
        <div className="rail-savelog">
          {data.saveLog.map((s, i) => (
            <div className="savelog-row" key={i}>
              <span className="savelog-ts">{s.ts}</span>
              <span className="savelog-what">
                <span style={{ color: "var(--text-1)" }}>{s.by}</span> {s.what}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="rail-section">
        <div className="rail-h">Shortcuts</div>
        <div className="rail-shortcuts">
          <div className="rail-kbd-row">
            <span className="rail-kbd-keys">
              <span className="kbd mono">E</span>
            </span>
            <span>toggle edit</span>
          </div>
          <div className="rail-kbd-row">
            <span className="rail-kbd-keys">
              <span className="kbd mono">⌘S</span>
            </span>
            <span>save</span>
          </div>
          <div className="rail-kbd-row">
            <span className="rail-kbd-keys">
              <span className="kbd mono">⌘K</span>
            </span>
            <span>palette</span>
          </div>
          <div className="rail-kbd-row">
            <span className="rail-kbd-keys">
              <span className="kbd mono">⌘↵</span>
            </span>
            <span>approve</span>
          </div>
          <div className="rail-kbd-row">
            <span className="rail-kbd-keys">
              <span className="kbd mono">esc</span>
            </span>
            <span>back to dashboard</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Preview (read mode) ────────────────────────────────────────────────────
function Preview({ parsed, threads, expanded, onToggleSection, onResolve, activeSection, onSectionRef }) {
  const renderBody = (lines) => {
    const blocks = [];
    let cur = { kind: "p", lines: [] };
    const push = () => {
      if (cur.lines.length || cur.kind === "p") blocks.push(cur);
    };
    for (const raw of lines) {
      const l = raw.trimEnd();
      if (l === "") {
        if (cur.lines.length) { push(); cur = { kind: "p", lines: [] }; }
        continue;
      }
      const num = l.match(/^(\s*)(\d+)\.\s+(.*)/);
      const bull = l.match(/^(\s*)-\s+\[\s\]\s+(.*)/) ? null : l.match(/^(\s*)-\s+(.*)/);
      const task = l.match(/^(\s*)-\s+\[\s\]\s+(.*)/);
      const isContinuation = /^\s{2,}\S/.test(l) && cur.kind !== "p" && cur.lines.length;
      if (isContinuation) {
        const last = cur.lines[cur.lines.length - 1];
        last.text += " " + l.trim();
        continue;
      }
      if (num) {
        if (cur.kind !== "ol") { push(); cur = { kind: "ol", lines: [] }; }
        cur.lines.push({ mark: num[2] + ".", text: num[3] });
      } else if (task) {
        if (cur.kind !== "task") { push(); cur = { kind: "task", lines: [] }; }
        cur.lines.push({ task: true, text: task[2] });
      } else if (bull) {
        if (cur.kind !== "ul") { push(); cur = { kind: "ul", lines: [] }; }
        cur.lines.push({ mark: "•", text: bull[2] });
      } else {
        if (cur.kind !== "p") { push(); cur = { kind: "p", lines: [] }; }
        cur.lines.push({ text: l });
      }
    }
    push();

    return blocks.map((b, i) => {
      if (b.kind === "p") {
        return (
          <p
            key={i}
            dangerouslySetInnerHTML={{ __html: b.lines.map(x => renderInline(x.text)).join("<br/>") }}
          />
        );
      }
      const Tag = b.kind === "ol" ? "ol" : "ul";
      return (
        <Tag key={i}>
          {b.lines.map((x, j) => (
            <li className="rv-li" key={j}>
              {x.task
                ? <span className="rv-li-task" />
                : <span className="rv-li-mark mono">{x.mark}</span>}
              <span dangerouslySetInnerHTML={{ __html: renderInline(x.text) }} />
            </li>
          ))}
        </Tag>
      );
    });
  };

  return (
    <div className="rv-preview">
      <div className="rv-doc">
        <h1 className="rv-h1">{parsed.title}</h1>
        {parsed.frontmatter.length > 0 && (
          <div className="rv-frontmatter">
            {parsed.frontmatter.map((line, i) => (
              <div key={i} dangerouslySetInnerHTML={{ __html: renderInline(line) }} />
            ))}
          </div>
        )}

        {parsed.sections.map((s, idx) => {
          const ts = threads[s.id] || [];
          const open = ts.filter(t => !t.resolved);
          const isExpanded = expanded.has(s.id);
          return (
            <section
              className="rv-section"
              id={`sec-${s.id}`}
              key={s.id}
              ref={(el) => onSectionRef(s.id, el)}
            >
              <div className="rv-section-head">
                <span className="rv-section-num mono">§{idx + 1}</span>
                <h2 className="rv-section-h">{s.h}</h2>
                <span className="rv-section-anchor mono">#{s.id}</span>
                <div className={`rv-section-tools ${ts.length > 0 ? "rv-section-tools-pinned" : ""}`}>
                  <button className="rv-section-tool" title="Regenerate section">
                    <IconRegen size={11} stroke={1.8} />
                  </button>
                  <button
                    className={`rv-section-tool ${ts.length ? "rv-section-tool-active" : ""}`}
                    title={ts.length ? `${ts.length} thread${ts.length > 1 ? "s" : ""}` : "Comment on section"}
                    onClick={() => onToggleSection(s.id)}
                  >
                    <IconChat size={11} stroke={1.8} />
                    {ts.length > 0 && <span className="rv-section-tool-badge mono">{ts.length}</span>}
                  </button>
                </div>
              </div>
              <div className="rv-body-text">{renderBody(s.body)}</div>

              {isExpanded && ts.length > 0 && (
                <div className="rv-threads">
                  {ts.map(t => (
                    <Thread
                      key={t.id}
                      thread={t}
                      onResolve={() => onResolve(s.id, t.id)}
                    />
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function Thread({ thread, onResolve }) {
  return (
    <div className={`rv-thread ${thread.resolved ? "rv-thread-resolved" : ""}`}>
      <div className="rv-thread-head">
        <span className="rv-thread-anchor mono">
          <IconChat size={10} stroke={2} />
          {thread.anchor}
        </span>
        <span className={`rv-thread-status mono ${thread.resolved ? "rv-thread-status-resolved" : ""}`}>
          {thread.resolved ? "resolved" : "open"}
        </span>
        <div className="rv-thread-actions">
          {!thread.resolved && (
            <button className="btn-ghost btn-ghost-mini" onClick={onResolve}>
              <IconCheck size={9} stroke={2.2} /> resolve
            </button>
          )}
        </div>
      </div>
      <div>
        {thread.history.map((m, i) => (
          <div className="rv-thread-msg" key={i}>
            <div className="rv-thread-msg-head">
              <span className={`rv-thread-author mono ${m.author === "claude" ? "rv-thread-author-ai" : ""}`}>
                {m.author === "claude" ? <IconSpark size={9} stroke={2} /> : null}
                @{m.author}
              </span>
              <span className="rv-thread-ts mono">{m.ts}</span>
            </div>
            <div className="rv-thread-msg-body">{m.text}</div>
          </div>
        ))}
      </div>
      {!thread.resolved && (
        <div className="rv-thread-reply">
          <input
            className="rv-thread-reply-input"
            placeholder="Reply… Claude sees all open threads on submit"
          />
          <span className="rv-thread-reply-kbd">⏎</span>
          <button className="rv-thread-reply-send">send</button>
        </div>
      )}
    </div>
  );
}

// ── Editor (raw markdown with syntax tinting + line gutter + caret) ────────
function Editor({ source, activeLine, showLineNumbers }) {
  const lines = useMemoR(() => source.split("\n"), [source]);
  return (
    <div className="rv-editor">
      {showLineNumbers && (
        <div className="rv-editor-gutter">
          {lines.map((_, i) => (
            <span
              key={i}
              className={`rv-editor-gutter-row ${i + 1 === activeLine ? "rv-editor-gutter-row-active" : ""}`}
            >
              {i + 1}
            </span>
          ))}
        </div>
      )}
      <div className="rv-editor-code">
        {lines.map((l, i) => {
          const t = tintLine(l);
          const isActive = i + 1 === activeLine;
          return (
            <span
              key={i}
              className={`rv-editor-row ${t.className} ${isActive ? "rv-editor-row-active" : ""}`}
            >
              <span dangerouslySetInnerHTML={{ __html: t.html }} />
              {isActive && <span className="rv-editor-caret" />}
              {"\n"}
            </span>
          );
        })}
      </div>
    </div>
  );
}

// ── Status bar ─────────────────────────────────────────────────────────────
function StatusBar({ data, view, approved }) {
  return (
    <div className="rv-statusbar">
      <span className="rv-statusbar-item rv-statusbar-item-accent">
        <Icon size={10} stroke={1.8}><circle cx="8" cy="8" r="2.5" /></Icon>
        {view}
      </span>
      <span className="rv-statusbar-sep">·</span>
      <span className="rv-statusbar-item">
        <IconBranch size={10} stroke={1.8} />
        {data.user.repo}@{data.user.branch}
      </span>
      <span className="rv-statusbar-sep">·</span>
      <span className="rv-statusbar-item">
        <IconClock size={10} stroke={1.8} />
        last write {data.spec.savedAt}
      </span>
      <span className="rv-statusbar-sep">·</span>
      <span className="rv-statusbar-item">
        {approved
          ? <><IconCheck size={10} stroke={2.4} /> spec approved · agents unlocked</>
          : <>spec status: <span style={{ color: "var(--warn)" }}>{data.spec.status}</span></>}
      </span>
      <span className="rv-statusbar-grow" />
      <span className="rv-statusbar-item">
        <span className="rv-statusbar-kbd">E</span>
        edit
      </span>
      <span className="rv-statusbar-item">
        <span className="rv-statusbar-kbd">⌘S</span>
        save
      </span>
      <span className="rv-statusbar-item">
        <span className="rv-statusbar-kbd">⌘↵</span>
        approve
      </span>
      <span className="rv-statusbar-item">
        <span className="rv-statusbar-kbd">⌘⇧↵</span>
        submit & regen
      </span>
    </div>
  );
}

// ── Root ───────────────────────────────────────────────────────────────────
function SpecReviewApp({ initialView, initialExpandAll, initialShowRail, initialShowLineNumbers, initialActiveSection }) {
  const data = window.FORGE_REVIEW;
  const parsed = useMemoR(() => parseSpec(data.source), [data.source]);

  // Per-section thread state with local resolve override
  const [resolveMap, setResolveMap] = useStateR({});
  const liveThreads = useMemoR(() => {
    const out = {};
    for (const sid of Object.keys(data.threads)) {
      out[sid] = data.threads[sid].map(t => ({
        ...t,
        resolved: resolveMap[`${sid}/${t.id}`] ?? t.resolved,
      }));
    }
    return out;
  }, [data.threads, resolveMap]);

  const allThreadCounts = useMemoR(() => {
    const o = {};
    for (const sid of Object.keys(liveThreads)) {
      o[sid] = liveThreads[sid].filter(t => !t.resolved).length;
    }
    return o;
  }, [liveThreads]);
  const totalOpen = useMemoR(
    () => Object.values(allThreadCounts).reduce((a, b) => a + b, 0),
    [allThreadCounts],
  );

  const [view, setView] = useStateR(initialView);
  useEffectR(() => { setView(initialView); }, [initialView]);

  const [activeSection, setActiveSection] = useStateR(initialActiveSection);
  useEffectR(() => { setActiveSection(initialActiveSection); }, [initialActiveSection]);

  const [expanded, setExpanded] = useStateR(() => {
    const s = new Set();
    if (initialExpandAll) {
      for (const sid of Object.keys(data.threads)) s.add(sid);
    }
    return s;
  });
  useEffectR(() => {
    const s = new Set();
    if (initialExpandAll) {
      for (const sid of Object.keys(data.threads)) s.add(sid);
    }
    setExpanded(s);
  }, [initialExpandAll, data.threads]);

  const [approved, setApproved] = useStateR(false);
  const sectionRefs = useRefR({});
  const onSectionRef = (id, el) => { sectionRefs.current[id] = el; };

  // Scroll to active section when it changes
  useEffectR(() => {
    if (view === "edit") return;
    const el = sectionRefs.current[activeSection];
    if (el) {
      // use container scroll instead of element.scrollIntoView
      const container = el.closest(".rv-preview");
      if (container) {
        const top = el.offsetTop - 24;
        container.scrollTo({ top, behavior: "smooth" });
      }
    }
  }, [activeSection, view]);

  const toggleSection = (sid) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(sid) ? next.delete(sid) : next.add(sid);
      return next;
    });
  };

  const resolve = (sid, tid) => {
    setResolveMap(m => ({ ...m, [`${sid}/${tid}`]: true }));
  };

  const jumpToFirstThread = () => {
    for (const s of parsed.sections) {
      if ((allThreadCounts[s.id] || 0) > 0) {
        setActiveSection(s.id);
        setExpanded(prev => new Set([...prev, s.id]));
        return;
      }
    }
  };

  // active line for editor: roughly the line of the active section's "step 4" or its head
  const activeLine = useMemoR(() => {
    const lines = data.source.split("\n");
    const ix = lines.findIndex(l => l.startsWith("## ") && slug(l.slice(3)) === activeSection);
    if (ix < 0) return 1;
    // for approach, point at step 4 (the line where the comment is anchored)
    if (activeSection === "suggested-approach") {
      for (let j = ix; j < lines.length; j++) if (/^4\.\s/.test(lines[j])) return j + 1;
    }
    return ix + 2;
  }, [activeSection, data.source]);

  const showRail = initialShowRail;
  const showEditor = view === "edit" || view === "split";
  const showPreview = view === "read" || view === "split";

  return (
    <div className="review-app">
      <TopBar
        data={data}
        view={view}
        onView={setView}
        openThreads={totalOpen}
        onApprove={() => setApproved(true)}
        approved={approved}
      />
      <SubBar
        data={data}
        openThreads={totalOpen}
        view={view}
        onJumpToFirstThread={jumpToFirstThread}
      />
      <div className={`rv-body ${showRail ? "" : "rv-body-no-rail"}`}>
        {showRail && (
          <Rail
            data={data}
            parsed={parsed}
            activeSection={activeSection}
            onSection={setActiveSection}
            allThreadCounts={allThreadCounts}
            totalThreads={totalOpen}
          />
        )}
        <div className="rv-main">
          <div className={`rv-mainsplit ${view === "edit" ? "rv-mainsplit-edit" : ""} ${view === "read" ? "rv-mainsplit-read" : ""}`}>
            {showEditor && (
              <div className="rv-pane rv-pane-editor">
                <div className="rv-pane-head">
                  <Icon size={11} stroke={1.8}><path d="M3 3h10v10H3z" /><path d="M6 6h4M6 9h4" /></Icon>
                  <span>source · markdown</span>
                  <span className="grow" />
                  <span className="rv-pane-tag">{data.spec.path.split("/").pop()}</span>
                </div>
                <Editor
                  source={data.source}
                  activeLine={activeLine}
                  showLineNumbers={initialShowLineNumbers}
                />
              </div>
            )}
            {showPreview && (
              <div className="rv-pane rv-pane-preview">
                <div className="rv-pane-head">
                  <IconBook size={11} stroke={1.8} />
                  <span>preview</span>
                  <span className="grow" />
                  <span className="rv-pane-tag">{parsed.sections.length} sections</span>
                </div>
                <Preview
                  parsed={parsed}
                  threads={liveThreads}
                  expanded={expanded}
                  onToggleSection={toggleSection}
                  onResolve={resolve}
                  activeSection={activeSection}
                  onSectionRef={onSectionRef}
                />
              </div>
            )}
          </div>
        </div>
      </div>
      <StatusBar data={data} view={view} approved={approved} />
    </div>
  );
}

window.SpecReviewApp = SpecReviewApp;
