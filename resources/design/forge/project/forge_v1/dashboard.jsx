// Forge v1.0 — App shell: top bar, nav rail, view routing
const { useState, useMemo, useEffect, useRef } = React;

// ──────────────────────────────────────────────────────────────────────────────
// Shared helpers (also used by panels/drawer)

const priorityMeta = {
  urgent: { label: "Urgent", color: "var(--danger)",  Icon: IconFlame },
  high:   { label: "High",   color: "var(--warn)",    Icon: IconArrowUp },
  med:    { label: "Med",    color: "var(--text-2)",  Icon: IconMinus },
  low:    { label: "Low",    color: "var(--text-3)",  Icon: IconArrowDown },
};

const groupMeta = {
  Bugs:    { color: "var(--danger)",  Icon: IconBug,      tone: "rgba(245, 95, 95, 0.45)" },
  Urgent:  { color: "var(--warn)",    Icon: IconFlame,    tone: "rgba(245, 175, 60, 0.45)" },
  Feature: { color: "var(--accent)",  Icon: IconSpark,    tone: "rgba(113, 128, 245, 0.45)" },
  Chore:   { color: "var(--text-3)",  Icon: IconTerminal, tone: "rgba(78, 87, 107, 0.55)" },
};

function StatusDot({ state, size = 6 }) {
  const color =
    state === "connected" || state === "running" || state === "done" || state === "ok" ? "var(--ok)"
    : state === "review" || state === "warning" || state === "warn"  ? "var(--warn)"
    : state === "error" || state === "disconnected" || state === "failed" ? "var(--danger)"
    : state === "queued" ? "var(--text-3)"
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

function Kbd({ children }) {
  return <span className="kbd mono">{children}</span>;
}

// ──────────────────────────────────────────────────────────────────────────────
// Left nav rail

function NavRail({ view, setView }) {
  const items = [
    { id: "dashboard", Icon: IconDashboard, label: "Dashboard" },
    { id: "orch",      Icon: IconOrch,      label: "Orchestrator", badge: 1 },
    { id: "specs",     Icon: IconBook,      label: "Specs library" },
    { id: "plugins",   Icon: IconPlug,      label: "Skills & plugins" },
  ];
  return (
    <nav className="navrail">
      <div className="navrail-mark">
        <span className="brand-mark" />
      </div>
      <div className="navrail-items">
        {items.map(({ id, Icon, label, badge }) => (
          <button
            key={id}
            className={`navrail-btn ${view === id ? "navrail-btn-active" : ""}`}
            onClick={() => setView(id)}
            title={label}
          >
            <Icon size={15} stroke={1.6} />
            {badge && <span className="navrail-badge">{badge}</span>}
          </button>
        ))}
      </div>
      <div className="navrail-foot">
        <button
          className={`navrail-btn ${view === "settings" ? "navrail-btn-active" : ""}`}
          onClick={() => setView("settings")}
          title="Settings"
        >
          <IconSettings size={15} stroke={1.6} />
        </button>
      </div>
    </nav>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Top bar with Cmd+K palette trigger + cost pill

function TopBar({ data, onPalette }) {
  return (
    <div className="topbar">
      <div className="topbar-left">
        <span className="brand">FORGE <span className="brand-version mono">1.0</span></span>
        <span className="topbar-sep" />
        <span className="repo-chip mono">
          <IconFolder size={10} stroke={1.75} />
          {data.user.repo}
        </span>
        <span className="repo-chip mono">
          <IconBranch size={10} stroke={1.75} />
          {data.user.branch}
        </span>
      </div>

      <button className="cmdk-bar" onClick={onPalette}>
        <IconSearch size={12} stroke={1.7} />
        <span className="cmdk-placeholder">Search issues, specs, agents…</span>
        <span className="cmdk-spacer" />
        <Kbd>⌘</Kbd><Kbd>K</Kbd>
      </button>

      <div className="topbar-right">
        <span className="cost-pill mono" title="Today's API spend">
          <IconCoin size={11} stroke={1.6} />
          <span className="cost-amt">{data.costToday.spend}</span>
          <span className="cost-sub dim">today</span>
        </span>
        <div className="auth-strip">
          {data.auth.slice(0, 3).map(a => (
            <span key={a.id} className="auth-pill" title={`${a.name} · ${a.detail}`}>
              <StatusDot state={a.state} />
              <span className="auth-pill-name">{a.name}</span>
            </span>
          ))}
        </div>
        <span className="topbar-sep" />
        <span className="mono dim sync-stamp">
          sync <span style={{ color: "var(--text-1)" }}>{data.lastSync}</span>
        </span>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Command palette (Cmd+K)

function CmdPalette({ open, onClose }) {
  const data = window.FORGE_DATA;
  const items = useMemo(() => ([
    ...data.issues.slice(0, 8).map(i => ({ kind: "issue", id: i.id, title: i.title, sub: i.group + " · " + i.label })),
    { kind: "action", id: "act_newagent",  title: "Launch new agent…",      sub: "⌘ + N" },
    { kind: "action", id: "act_orch",      title: "Start orchestrator…",    sub: "⌘ + ⇧ + O" },
    { kind: "action", id: "act_settings",  title: "Open settings",          sub: "⌘ + ," },
  ]), []);

  useEffect(() => {
    const k = (e) => { if (e.key === "Escape") onClose(); };
    if (open) window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open]);

  if (!open) return null;

  return (
    <div className="cmdk-scrim" onClick={onClose}>
      <div className="cmdk-modal" onClick={e => e.stopPropagation()}>
        <div className="cmdk-input-row">
          <IconSearch size={13} stroke={1.7} />
          <input className="cmdk-input" autoFocus placeholder="Search issues, specs, agents, actions…" />
          <Kbd>Esc</Kbd>
        </div>
        <div className="cmdk-list">
          {items.map((it, i) => (
            <div className={`cmdk-row ${i === 0 ? "cmdk-row-active" : ""}`} key={it.id}>
              <span className="cmdk-row-kind mono">
                {it.kind === "issue" ? <IconBook size={11} stroke={1.7} /> : <IconBolt size={11} stroke={1.7} />}
                {it.kind === "issue" ? it.id : "action"}
              </span>
              <span className="cmdk-row-title">{it.title}</span>
              <span className="cmdk-row-sub mono dim">{it.sub}</span>
            </div>
          ))}
        </div>
        <div className="cmdk-foot mono dim">
          <span><Kbd>↑↓</Kbd> navigate</span>
          <span><Kbd>⏎</Kbd> select</span>
          <span><Kbd>⌘</Kbd><Kbd>⏎</Kbd> open in drawer</span>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Root

function Dashboard({ initialDrawerIssue = null, initialTab = "Todo", initialView = "dashboard" }) {
  const data = window.FORGE_DATA;
  const [view, setView] = useState(initialView);
  const [tab, setTab] = useState(initialTab);
  const [drawerIssue, setDrawerIssue] = useState(
    initialDrawerIssue ? data.issues.find(i => i.id === initialDrawerIssue) : null
  );
  const [drawerTab, setDrawerTab] = useState("spec");
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => { setView(initialView); }, [initialView]);
  useEffect(() => {
    if (initialDrawerIssue) {
      const iss = data.issues.find(i => i.id === initialDrawerIssue);
      setDrawerIssue(iss || null);
    } else setDrawerIssue(null);
  }, [initialDrawerIssue]);

  const openIssue = (issue, which = "spec") => {
    setDrawerIssue(issue);
    setDrawerTab(which);
  };
  const closeDrawer = () => setDrawerIssue(null);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") { closeDrawer(); setPaletteOpen(false); }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(o => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="app" data-view={view}>
      <NavRail view={view} setView={setView} />
      <div className="app-main">
        <TopBar data={data} onPalette={() => setPaletteOpen(true)} />
        <div className="zones">
          {view === "dashboard" && (
            <>
              <IssueListPanel
                issues={data.issues}
                tab={tab}
                setTab={setTab}
                onOpen={openIssue}
                activeId={drawerIssue?.id}
              />
              <RightPanel data={data} onOpen={openIssue} />
            </>
          )}
          {view === "orch" && (
            <OrchestratorView data={data} onOpen={openIssue} />
          )}
          {view === "specs" && (
            <SpecsLibraryView data={data} onOpen={openIssue} />
          )}
          {view === "plugins" && (
            <PluginsView data={data} />
          )}
          {view === "settings" && (
            <SettingsView data={data} />
          )}
        </div>
      </div>

      <SpecDrawer
        issue={drawerIssue}
        tab={drawerTab}
        setTab={setDrawerTab}
        onClose={closeDrawer}
      />
      <CmdPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}

Object.assign(window, {
  Dashboard, StatusDot, PriorityChip, LabelBadge, Kbd, priorityMeta, groupMeta,
});
