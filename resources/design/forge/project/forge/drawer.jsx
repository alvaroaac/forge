// Forge — Spec drawer (slides over right panel)
const { useState: useStateDrawer, useEffect: useEffectDrawer } = React;

function MarkdownSection({ h, body }) {
  // Lines that start with •/digit. get bullet styling; others render as paragraphs
  const lines = body.split("\n");
  return (
    <section className="md-section">
      <h3 className="md-h">{h}</h3>
      <div className="md-body">
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
      </div>
    </section>
  );
}

// Highlight `code` spans and §refs without bringing in a markdown lib
function highlightInline(s) {
  return s
    .replace(/`([^`]+)`/g, '<code class="md-code">$1</code>')
    .replace(/(§\d+(?:\.\d+)?)/g, '<span class="md-ref">$1</span>')
    .replace(/@(\w+)/g, '<span class="md-mention">@$1</span>');
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
        <h3 className="md-h">Comments <span className="mono dim" style={{ fontWeight: 400 }}>({spec.comments.length})</span></h3>
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

  // reset when issue changes
  useEffectDrawer(() => { setApproved(issue.specStatus === "approved"); }, [issue.id]);

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

  return (
    <div className="spec-tab">
      <div className="spec-meta-strip">
        <span className="mono dim">spec/{issue.id.toLowerCase()}.md</span>
        <span className="mono dim">·</span>
        <span className="mono dim">generated 3m ago</span>
        <span className="mono dim">·</span>
        <span className="mono dim">152 lines</span>
        <span style={{ flex: 1 }} />
        <button className="btn-ghost"><IconEdit size={11} stroke={2} /> Review</button>
      </div>

      <div className="spec-scroll">
        {spec.spec.sections.map((s, i) => (
          <MarkdownSection key={i} {...s} />
        ))}
      </div>

      <div className="spec-foot">
        <div className="spec-foot-row">
          <button className="btn-ghost">
            <IconEdit size={11} stroke={2} /> Review Spec
          </button>
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
            <span>Continue with <strong>Claude Code</strong></span>
            <span className="mono dim" style={{ marginLeft: "auto", fontSize: 11 }}>⌘⏎</span>
          </button>
          <button className={`launch-btn ${!approved ? "launch-disabled" : ""}`} disabled={!approved}>
            <IconTerminal size={12} stroke={2} />
            <span>Continue with <strong>Codex</strong></span>
            <span className="mono dim" style={{ marginLeft: "auto", fontSize: 11 }}>⌘⇧⏎</span>
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
