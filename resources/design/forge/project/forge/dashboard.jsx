// Forge — Dashboard
// Three-zone layout: top bar / left issue list / right ops panel + spec drawer overlay
const { useState, useMemo, useEffect, useRef } = React;

// ──────────────────────────────────────────────────────────────────────────────
// Helpers

const priorityMeta = {
  urgent: { label: "Urgent", color: "var(--danger)",  Icon: IconFlame },
  high:   { label: "High",   color: "var(--warn)",    Icon: IconArrowUp },
  med:    { label: "Med",    color: "var(--text-2)",  Icon: IconMinus },
  low:    { label: "Low",    color: "var(--text-3)",  Icon: IconArrowDown },
};

const groupMeta = {
  Bugs:    { color: "var(--danger)",  Icon: IconBug,   tone: "rgba(245, 95, 95, 0.45)" },
  Urgent:  { color: "var(--warn)",    Icon: IconFlame, tone: "rgba(245, 175, 60, 0.45)" },
  Feature: { color: "var(--accent)",  Icon: IconSpark, tone: "rgba(113, 128, 245, 0.45)" },
  Chore:   { color: "var(--text-3)",  Icon: IconTerminal, tone: "rgba(78, 87, 107, 0.55)" },
};

function StatusDot({ state, size = 6 }) {
  const color =
    state === "connected" || state === "running" ? "var(--ok)"
    : state === "review" || state === "warning"  ? "var(--warn)"
    : state === "error" || state === "disconnected" ? "var(--danger)"
    : "var(--text-3)";
  return (
    <span
      aria-label={state}
      style={{
        display: "inline-block",
        width: size, height: size, borderRadius: 999,
        background: color,
        boxShadow: `0 0 0 2px ${color}22`,
        flex: "none",
      }}
    />
  );
}

function PillTab({ active, count, children, onClick }) {
  return (
    <button className={`tab ${active ? "tab-active" : ""}`} onClick={onClick}>
      <span>{children}</span>
      <span className="tab-count">{count}</span>
    </button>
  );
}

function PriorityChip({ priority }) {
  const m = priorityMeta[priority];
  if (!m) return null;
  const Ico = m.Icon;
  return (
    <span className="chip" style={{ color: m.color }}>
      <Ico size={10} stroke={2} />
      <span>{m.label}</span>
    </span>
  );
}

function LabelBadge({ label }) {
  return <span className="label-badge">{label}</span>;
}

// ──────────────────────────────────────────────────────────────────────────────
// Issue card

function IssueCard({ issue, onOpen, isActive }) {
  const g = groupMeta[issue.group] || groupMeta.Chore;
  const hasSpec = issue.specStatus !== "none";
  const approved = issue.specStatus === "approved";
  return (
    <div
      className={`issue-card ${isActive ? "issue-card-active" : ""}`}
      style={{ borderLeftColor: g.color }}
      onClick={() => onOpen(issue, "spec")}
    >
      <div className="issue-card-top">
        <span className="mono dim">{issue.id}</span>
        {approved && (
          <span className="mono dim" style={{ color: "var(--ok)", display: "inline-flex", alignItems: "center", gap: 3 }}>
            <IconCheck size={10} stroke={2} /> approved
          </span>
        )}
      </div>
      <div className="issue-card-title">{issue.title}</div>
      <div className="issue-card-meta">
        <LabelBadge label={issue.label} />
        <PriorityChip priority={issue.priority} />
      </div>
      <div className="issue-card-actions" onClick={(e) => e.stopPropagation()}>
        <button
          className={`btn-ghost ${hasSpec ? "btn-ghost-accent" : ""}`}
          onClick={() => onOpen(issue, "spec")}
        >
          {hasSpec ? "View Spec" : "Spec"}
        </button>
        <button className="btn-ghost" onClick={() => onOpen(issue, "detail")}>
          Detail <IconChevronRight size={10} stroke={2} />
        </button>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Issue group — horizontal scroller, 2 rows

function IssueGroup({ name, items, onOpen, activeId }) {
  const g = groupMeta[name] || groupMeta.Chore;
  const Ico = g.Icon;
  const scrollerRef = useRef(null);
  const [overflowRight, setOverflowRight] = useState(false);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const check = () => setOverflowRight(el.scrollWidth - el.clientWidth - el.scrollLeft > 8);
    check();
    el.addEventListener("scroll", check);
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => { el.removeEventListener("scroll", check); ro.disconnect(); };
  }, [items.length]);

  // Layout: items into 2 rows, columns flow horizontally
  const rows = [[], []];
  items.forEach((it, i) => rows[i % 2].push(it));

  return (
    <div className="group">
      <div className="group-head">
        <span className="group-head-left">
          <Ico size={11} stroke={2} style={{ color: g.color }} />
          <span className="group-name">{name}</span>
          <span className="group-count mono">{items.length}</span>
        </span>
        {overflowRight && (
          <span className="group-overflow mono">scroll <IconChevronRight size={10} stroke={2} /></span>
        )}
      </div>
      <div className="group-scroller-wrap">
        <div className="group-scroller" ref={scrollerRef}>
          {rows.map((row, ri) => (
            <div className="group-row" key={ri}>
              {row.map((iss) => (
                <IssueCard
                  key={iss.id}
                  issue={iss}
                  onOpen={onOpen}
                  isActive={iss.id === activeId}
                />
              ))}
            </div>
          ))}
        </div>
        {overflowRight && <div className="group-fade" />}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Left panel

function IssueListPanel({ issues, tab, setTab, onOpen, activeId }) {
  const tabs = ["Todo", "In Progress", "In Review", "Done"];
  const tabKey = { "Todo": "todo", "In Progress": "in-progress", "In Review": "in-review", "Done": "done" };

  const counts = Object.fromEntries(
    tabs.map(t => [t, issues.filter(i => i.status === tabKey[t]).length])
  );

  const visible = issues.filter(i => i.status === tabKey[tab]);
  const groupOrder = ["Bugs", "Urgent", "Feature", "Chore"];
  const grouped = groupOrder
    .map(g => ({ name: g, items: visible.filter(i => i.group === g) }))
    .filter(g => g.items.length > 0);

  return (
    <div className="panel-left">
      <div className="panel-left-head">
        <div className="tabs">
          {tabs.map(t => (
            <PillTab key={t} active={tab === t} count={counts[t]} onClick={() => setTab(t)}>
              {t}
            </PillTab>
          ))}
        </div>
        <div className="panel-left-tools">
          <button className="icon-btn" title="Refresh"><IconRefresh size={12} /></button>
        </div>
      </div>

      <div className="panel-left-body">
        {grouped.length === 0 ? (
          <div className="empty">No issues in {tab.toLowerCase()}.</div>
        ) : (
          grouped.map(g => (
            <IssueGroup
              key={g.name}
              name={g.name}
              items={g.items}
              onOpen={onOpen}
              activeId={activeId}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Right panel — auth, activity, agents

function AuthRow({ name, state, detail }) {
  return (
    <div className="auth-row">
      <StatusDot state={state} />
      <span className="auth-name">{name}</span>
      <span className="auth-detail mono">{detail}</span>
      <span className="auth-state mono" style={{ color: state === "connected" ? "var(--ok)" : "var(--danger)" }}>
        {state}
      </span>
    </div>
  );
}

function ActivityRow({ item }) {
  return (
    <div className="activity-row">
      <span className="mono activity-id">{item.id}</span>
      <span className="activity-text">{item.text}</span>
      <span className="mono dim activity-ts">{item.ts}</span>
    </div>
  );
}

function AgentCard({ agent }) {
  const isReview = agent.status === "review";
  return (
    <div className="agent-card">
      <div className="agent-card-head">
        <span className="agent-type mono">
          {agent.type === "Claude Code" ? <IconSpark size={11} stroke={2} /> : <IconTerminal size={11} stroke={2} />}
          {agent.type}
        </span>
        <span className="agent-issue mono">{agent.issueId}</span>
        <span className="agent-spacer" />
        <span className="agent-status">
          <StatusDot state={agent.status} />
          <span className="mono dim">
            {isReview ? `review · ${agent.elapsed}` : `running · ${agent.elapsed}`}
          </span>
        </span>
      </div>
      <div className="agent-output mono">{agent.output}</div>
      <div className="agent-meta mono">
        <span className="agent-meta-item" title="Worktree">
          <IconFolder size={10} stroke={1.75} />
          <span className="agent-meta-text">{agent.worktree}</span>
        </span>
        <span className="agent-meta-sep">·</span>
        <span className="agent-meta-item" title="Git branch">
          <IconBranch size={10} stroke={1.75} />
          <span className="agent-meta-text">{agent.branch}</span>
        </span>
        <span className="agent-meta-sep">·</span>
        <span className="agent-meta-item agent-meta-model" title="Model">
          <IconCpu size={10} stroke={1.75} />
          <span className="agent-meta-text">{agent.model}</span>
        </span>
      </div>
      <div className="agent-card-foot">
        <button className="btn-ghost">Logs</button>
        <button className="btn-ghost btn-ghost-accent">Manage <IconChevronRight size={10} stroke={2} /></button>
      </div>
    </div>
  );
}

function RightPanel({ data, onOpen }) {
  return (
    <div className="panel-right">
      {/* Auth */}
      <section className="rp-section">
        <h3 className="rp-h">Connections</h3>
        <div className="auth-list">
          {data.auth.map(a => <AuthRow key={a.id} {...a} />)}
        </div>
      </section>

      {/* Activity */}
      <section className="rp-section">
        <h3 className="rp-h">Recent activity</h3>
        <div className="activity-list">
          {data.activity.map((a, i) => <ActivityRow key={i} item={a} />)}
        </div>
      </section>

      {/* Agents */}
      <section className="rp-section rp-section-grow">
        <div className="rp-section-head">
          <h3 className="rp-h">Running agents <span className="mono dim">({data.agents.length})</span></h3>
          <button className="btn-accent">
            <IconPlus size={11} stroke={2} /> New Agent
          </button>
        </div>
        <div className="agent-list">
          {data.agents.length === 0 ? (
            <div className="empty empty-agents">
              <div className="mono dim" style={{ marginBottom: 6 }}>$ forge agent ls</div>
              No agents running. Select a spec to launch one.
            </div>
          ) : (
            data.agents.map(a => <AgentCard key={a.id} agent={a} />)
          )}
        </div>
      </section>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Top bar

function TopBar({ data }) {
  return (
    <div className="topbar">
      <div className="topbar-left">
        <span className="brand">
          <span className="brand-mark" />
          FORGE
        </span>
        <span className="brand-sub mono dim">v0.1 · ENG team</span>
      </div>

      <div className="topbar-right">
        <div className="auth-strip">
          {data.auth.map(a => (
            <span key={a.id} className="auth-pill">
              <StatusDot state={a.state} />
              <span className="auth-pill-name">{a.name}</span>
            </span>
          ))}
        </div>
        <span className="topbar-sep" />
        <span className="mono dim sync-stamp">
          last sync <span style={{ color: "var(--text-1)" }}>{data.lastSync}</span>
        </span>
        <button className="icon-btn" title="Settings"><IconSettings size={14} /></button>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Root

function Dashboard({ initialDrawerIssue = null, initialTab = "Todo" }) {
  const data = window.FORGE_DATA;
  const [tab, setTab] = useState(initialTab);
  const [drawerIssue, setDrawerIssue] = useState(
    initialDrawerIssue ? data.issues.find(i => i.id === initialDrawerIssue) : null
  );
  const [drawerTab, setDrawerTab] = useState("spec");

  useEffect(() => {
    if (initialDrawerIssue) {
      const iss = data.issues.find(i => i.id === initialDrawerIssue);
      setDrawerIssue(iss || null);
    } else {
      setDrawerIssue(null);
    }
  }, [initialDrawerIssue]);

  const openIssue = (issue, which = "spec") => {
    setDrawerIssue(issue);
    setDrawerTab(which);
  };
  const closeDrawer = () => setDrawerIssue(null);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") closeDrawer(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="app">
      <TopBar data={data} />
      <div className="zones">
        <IssueListPanel
          issues={data.issues}
          tab={tab}
          setTab={setTab}
          onOpen={openIssue}
          activeId={drawerIssue?.id}
        />
        <RightPanel data={data} onOpen={openIssue} />
      </div>

      {/* Drawer overlay */}
      <SpecDrawer
        issue={drawerIssue}
        tab={drawerTab}
        setTab={setDrawerTab}
        onClose={closeDrawer}
      />
    </div>
  );
}

Object.assign(window, {
  Dashboard, StatusDot, priorityMeta, groupMeta,
});
