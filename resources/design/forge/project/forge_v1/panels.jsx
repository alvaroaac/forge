// Forge v1.0 — Panels: issue list, right panel (orchestrations, agents, activity, skills)
const { useState: useStateP, useEffect: useEffectP, useRef: useRefP } = React;

// ──────────────────────────────────────────────────────────────────────────────
// Issue card + group (carried over from v0.1)

function PillTab({ active, count, children, onClick }) {
  return (
    <button className={`tab ${active ? "tab-active" : ""}`} onClick={onClick}>
      <span>{children}</span>
      <span className="tab-count">{count}</span>
    </button>
  );
}

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

function IssueGroup({ name, items, onOpen, activeId }) {
  const g = groupMeta[name] || groupMeta.Chore;
  const Ico = g.Icon;
  const scrollerRef = useRefP(null);
  const [overflowRight, setOverflowRight] = useStateP(false);

  useEffectP(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const check = () => setOverflowRight(el.scrollWidth - el.clientWidth - el.scrollLeft > 8);
    check();
    el.addEventListener("scroll", check);
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => { el.removeEventListener("scroll", check); ro.disconnect(); };
  }, [items.length]);

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
                <IssueCard key={iss.id} issue={iss} onOpen={onOpen} isActive={iss.id === activeId} />
              ))}
            </div>
          ))}
        </div>
        {overflowRight && <div className="group-fade" />}
      </div>
    </div>
  );
}

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
          <button className="icon-btn" title="Filter"><IconChevronDown size={11} /></button>
          <button className="icon-btn" title="Refresh"><IconRefresh size={12} /></button>
        </div>
      </div>

      <div className="panel-left-body">
        {grouped.length === 0 ? (
          <div className="empty">No issues in {tab.toLowerCase()}.</div>
        ) : (
          grouped.map(g => (
            <IssueGroup key={g.name} name={g.name} items={g.items} onOpen={onOpen} activeId={activeId} />
          ))
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Live agent terminal (mini xterm-style pane)

const lineKindClass = {
  out:  "term-out",
  tool: "term-tool",
  ok:   "term-ok",
  warn: "term-warn",
  err:  "term-err",
  sys:  "term-sys",
};

function MiniTerm({ lines = [], height = 88, blink = true }) {
  const ref = useRefP(null);
  useEffectP(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines.length]);
  return (
    <div className="mini-term" style={{ height }} ref={ref}>
      {lines.map((l, i) => (
        <div key={i} className={`term-line ${lineKindClass[l.kind] || "term-out"}`}>
          <span className="term-prefix mono dim">{(i + 1).toString().padStart(2, "0")}</span>
          <span className="mono">{l.text}</span>
        </div>
      ))}
      {blink && <span className="term-caret mono" aria-hidden>▍</span>}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Agent card with live terminal

function AgentCard({ agent, onOpen }) {
  const isReview = agent.status === "review";
  const TypeIcon = agent.type === "Claude Code" ? IconSpark : IconTerminal;
  return (
    <div className={`agent-card ${isReview ? "agent-card-review" : "agent-card-running"}`}>
      <div className="agent-card-head">
        <span className="agent-type mono">
          <TypeIcon size={11} stroke={2} />
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
        <span className="agent-spacer" />
        <span className="agent-meta-item agent-meta-cost mono" title={`${agent.tokens.in} in · ${agent.tokens.out} out`}>
          <IconCoin size={10} stroke={1.75} />
          {agent.tokens.spend}
        </span>
      </div>

      <MiniTerm lines={agent.lines} height={108} blink={!isReview} />

      <div className="agent-card-foot">
        <button className="btn-ghost btn-ghost-danger" title="Kill (⌃C)">
          <IconKill size={9} stroke={2} /> Kill
        </button>
        <button className="btn-ghost" title="Pause">
          <IconPause size={9} stroke={2} /> Pause
        </button>
        <span style={{ flex: 1 }} />
        <button className="btn-ghost" onClick={() => onOpen(window.FORGE_DATA.issues.find(i => i.id === agent.issueId), "spec")}>
          Issue
        </button>
        <button className="btn-ghost btn-ghost-accent">
          Manage <IconChevronRight size={10} stroke={2} />
        </button>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Orchestration card (parent task + sub-task tree)

function SubtaskRow({ task, isLast }) {
  const isRunning = task.status === "running";
  const isDone = task.status === "done";
  const isQueued = task.status === "queued";
  return (
    <div className="subtask-row">
      <div className={`subtask-pipe ${isLast ? "subtask-pipe-last" : ""}`}>
        <span className={`subtask-bullet subtask-bullet-${task.status}`}>
          {isDone ? <IconCheck size={8} stroke={2.4} /> :
           isRunning ? <span className="bullet-pulse" /> :
           isQueued ? <IconClock size={8} stroke={2} /> : null}
        </span>
      </div>
      <div className="subtask-body">
        <div className="subtask-head">
          <span className="subtask-title">{task.title}</span>
          <span className="subtask-agent mono dim">
            {task.agent === "Claude Code" ? <IconSpark size={9} stroke={2} /> : <IconTerminal size={9} stroke={2} />}
            {task.agent}
          </span>
          <span className="subtask-elapsed mono dim">
            {task.elapsed || (isQueued ? "queued" : "—")}
          </span>
        </div>
        {task.line && isRunning && (
          <div className="subtask-line mono">{task.line}</div>
        )}
      </div>
    </div>
  );
}

function OrchCard({ orch, onOpen, compact = false }) {
  const issue = window.FORGE_DATA.issues.find(i => i.id === orch.issueId);
  const pct = (orch.progress.done / orch.progress.total) * 100;
  return (
    <div className="orch-card">
      <div className="orch-head">
        <span className="orch-icon">
          <IconOrch size={12} stroke={2} />
        </span>
        <span className="orch-issue mono">{orch.issueId}</span>
        <span className="orch-title">{orch.title}</span>
        <span className="agent-spacer" />
        <span className="agent-status">
          <StatusDot state="running" />
          <span className="mono dim">running · {orch.elapsed}</span>
        </span>
      </div>

      <div className="orch-progress">
        <div className="orch-progress-bar">
          <div className="orch-progress-fill" style={{ width: `${pct}%` }} />
          {Array.from({ length: orch.progress.total - 1 }).map((_, i) => (
            <span key={i} className="orch-progress-tick" style={{ left: `${((i + 1) / orch.progress.total) * 100}%` }} />
          ))}
        </div>
        <span className="orch-progress-label mono dim">
          {orch.progress.done}/{orch.progress.total}
        </span>
      </div>

      <div className="orch-meta mono dim">
        <IconFolder size={10} stroke={1.75} />
        <span>{orch.worktree}</span>
        <span className="agent-meta-sep">·</span>
        <IconBranch size={10} stroke={1.75} />
        <span>{orch.branch}</span>
      </div>

      <div className="subtask-list">
        {orch.subtasks.map((t, i) => (
          <SubtaskRow key={t.id} task={t} isLast={i === orch.subtasks.length - 1} />
        ))}
      </div>

      {!compact && (
        <div className="orch-foot">
          <button className="btn-ghost">
            <IconChat size={10} stroke={2} /> Steer
          </button>
          <button className="btn-ghost">Logs</button>
          <span style={{ flex: 1 }} />
          <button className="btn-ghost btn-ghost-accent" onClick={() => onOpen(issue, "spec")}>
            Open issue <IconChevronRight size={10} stroke={2} />
          </button>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Activity row — denser, type-aware

const activityIcon = {
  spec:     { Icon: IconBook,   color: "var(--accent)" },
  approve:  { Icon: IconCheck,  color: "var(--ok)" },
  agent:    { Icon: IconSpark,  color: "var(--accent)" },
  sync:     { Icon: IconRefresh, color: "var(--text-2)" },
  review:   { Icon: IconChat,   color: "var(--warn)" },
  "orch-done": { Icon: IconOrch, color: "var(--ok)" },
  warn:     { Icon: IconFlame,  color: "var(--warn)" },
};

function ActivityRow({ item }) {
  const meta = activityIcon[item.kind] || activityIcon.sync;
  const Ico = meta.Icon;
  return (
    <div className="activity-row">
      <span className="activity-ico" style={{ color: meta.color }}>
        <Ico size={10} stroke={2} />
      </span>
      <span className="mono activity-id">{item.id}</span>
      <span className="activity-text">{item.text}</span>
      <span className="mono dim activity-ts">{item.ts}</span>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Connections + Skills (combined)

function ConnectionsBlock({ auth, skills }) {
  return (
    <div className="conn-block">
      <div className="conn-row-grp">
        {auth.map(a => (
          <div className="conn-row" key={a.id}>
            <StatusDot state={a.state} />
            <span className="conn-name">{a.name}</span>
            <span className="conn-detail mono dim">{a.detail}</span>
          </div>
        ))}
      </div>
      <div className="conn-divider" />
      <div className="skills-row">
        <span className="conn-sub mono dim">skills</span>
        {skills.map(s => (
          <span
            key={s.id}
            className={`skill-pill mono ${s.state === "disabled" ? "skill-pill-off" : ""}`}
            title={`${s.name} v${s.version} · ${s.state}`}
          >
            <StatusDot state={s.state === "enabled" ? "connected" : "disconnected"} size={4} />
            {s.name}
          </span>
        ))}
        <button className="skill-pill skill-pill-add mono">
          <IconPlus size={9} stroke={2} /> add
        </button>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Right panel

function RightPanel({ data, onOpen }) {
  return (
    <div className="panel-right">
      {/* Orchestrations */}
      {data.orchestrations.length > 0 && (
        <section className="rp-section">
          <div className="rp-section-head">
            <h3 className="rp-h">
              <IconOrch size={11} stroke={2} />
              Orchestrations
              <span className="mono dim">({data.orchestrations.length})</span>
            </h3>
            <button className="btn-ghost">
              <IconPlus size={10} stroke={2} /> New orchestrator
            </button>
          </div>
          <div className="orch-list">
            {data.orchestrations.map(o => (
              <OrchCard key={o.id} orch={o} onOpen={onOpen} />
            ))}
          </div>
        </section>
      )}

      {/* Agents */}
      <section className="rp-section rp-section-grow">
        <div className="rp-section-head">
          <h3 className="rp-h">
            <IconSpark size={11} stroke={2} />
            Running agents
            <span className="mono dim">({data.agents.length})</span>
          </h3>
          <button className="btn-accent">
            <IconPlus size={11} stroke={2} /> New agent
            <span className="mono dim btn-kbd">⌘N</span>
          </button>
        </div>
        <div className="agent-list">
          {data.agents.length === 0 ? (
            <div className="empty empty-agents">
              <div className="mono dim" style={{ marginBottom: 6 }}>$ forge agent ls</div>
              No agents running. Select a spec to launch one.
            </div>
          ) : (
            data.agents.map(a => <AgentCard key={a.id} agent={a} onOpen={onOpen} />)
          )}
        </div>
      </section>

      {/* Activity */}
      <section className="rp-section rp-section-activity">
        <h3 className="rp-h">
          <IconClock size={11} stroke={2} />
          Recent activity
        </h3>
        <div className="activity-list">
          {data.activity.slice(0, 5).map((a, i) => <ActivityRow key={i} item={a} />)}
        </div>
      </section>

      {/* Connections + Skills */}
      <section className="rp-section rp-section-conn">
        <h3 className="rp-h">
          <IconPlug size={11} stroke={2} />
          Connections & skills
        </h3>
        <ConnectionsBlock auth={data.auth} skills={data.skills} />
      </section>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Alternate views (Orch focus / Specs library / Plugins / Settings)

function OrchestratorView({ data, onOpen }) {
  return (
    <div className="alt-view">
      <div className="alt-view-head">
        <h2 className="alt-view-h">Orchestrator</h2>
        <span className="alt-view-sub mono dim">parent issues broken into sub-tasks, executed sequentially</span>
        <span style={{ flex: 1 }} />
        <button className="btn-accent"><IconPlus size={11} stroke={2} /> New orchestration</button>
      </div>
      <div className="alt-view-body">
        <div className="orch-grid">
          {data.orchestrations.map(o => (
            <OrchCard key={o.id} orch={o} onOpen={onOpen} />
          ))}
          <div className="orch-card orch-card-empty">
            <div className="orch-empty-inner">
              <IconOrch size={20} stroke={1.5} />
              <div className="mono" style={{ fontWeight: 500 }}>Spawn an orchestration</div>
              <div className="mono dim" style={{ fontSize: 11 }}>
                Pick an issue. Forge will break it into sub-tasks,<br />
                dispatch agents in parallel, and QA each patch.
              </div>
              <button className="btn-ghost btn-ghost-accent" style={{ marginTop: 8 }}>
                <IconPlus size={10} stroke={2} /> Pick issue
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SpecsLibraryView({ data, onOpen }) {
  const specs = data.issues.filter(i => i.specStatus !== "none");
  return (
    <div className="alt-view">
      <div className="alt-view-head">
        <h2 className="alt-view-h">Specs library</h2>
        <span className="alt-view-sub mono dim">all generated specs · thoughts/tasks/</span>
        <span style={{ flex: 1 }} />
        <button className="btn-ghost"><IconRefresh size={11} /> Resync</button>
      </div>
      <div className="alt-view-body">
        <div className="spec-table">
          <div className="spec-table-head mono dim">
            <span>id</span>
            <span>title</span>
            <span>status</span>
            <span>path</span>
            <span>generated</span>
            <span></span>
          </div>
          {specs.map(s => {
            const g = groupMeta[s.group] || groupMeta.Chore;
            return (
              <div className="spec-table-row" key={s.id} onClick={() => onOpen(s, "spec")}>
                <span className="mono">{s.id}</span>
                <span className="spec-table-title">
                  <span className="spec-table-dot" style={{ background: g.color }} />
                  {s.title}
                </span>
                <span className="mono">
                  <StatusDot state={s.specStatus === "approved" ? "connected" : "review"} />
                  <span style={{ marginLeft: 6, color: s.specStatus === "approved" ? "var(--ok)" : "var(--warn)" }}>
                    {s.specStatus}
                  </span>
                </span>
                <span className="mono dim">thoughts/tasks/{s.id.toLowerCase()}/initial-spec.md</span>
                <span className="mono dim">{Math.floor(Math.random() * 6 + 1)}h ago</span>
                <span><IconChevronRight size={11} stroke={2} /></span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function PluginsView({ data }) {
  return (
    <div className="alt-view">
      <div className="alt-view-head">
        <h2 className="alt-view-h">Skills & plugins</h2>
        <span className="alt-view-sub mono dim">installed skills · .agents/skills/</span>
        <span style={{ flex: 1 }} />
        <button className="btn-ghost"><IconPlus size={11} /> Install skill</button>
      </div>
      <div className="alt-view-body">
        <div className="plugin-grid">
          {data.skills.map(s => (
            <div key={s.id} className={`plugin-card ${s.state === "disabled" ? "plugin-card-off" : ""}`}>
              <div className="plugin-head">
                <span className="plugin-name mono">{s.name}</span>
                <span className="plugin-version mono dim">v{s.version}</span>
              </div>
              <div className="plugin-state mono">
                <StatusDot state={s.state === "enabled" ? "connected" : "disconnected"} />
                {s.state}
              </div>
              <div className="plugin-foot">
                <button className="btn-ghost">Configure</button>
                <button className="btn-ghost">{s.state === "enabled" ? "Disable" : "Enable"}</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SettingsView({ data }) {
  const rows = [
    { k: "Repo path",     v: "~/code/humanlayer/riptide", action: "Change" },
    { k: "Linear team",   v: "ENG (sub-team: web)",       action: "Change" },
    { k: "Linear token",  v: "~/.humanlayer/riptide/linear.json", action: "Rotate" },
    { k: "Claude model",  v: "claude-sonnet-4-6",          action: "Change" },
    { k: "Codex model",   v: "gpt-5-codex",                action: "Change" },
    { k: "Worktrees dir", v: "~/wt/forge-*",               action: "Change" },
    { k: "Poll interval", v: "60s",                        action: "Edit" },
    { k: "Auto-update",   v: "enabled · stable channel",   action: "Edit" },
  ];
  return (
    <div className="alt-view">
      <div className="alt-view-head">
        <h2 className="alt-view-h">Settings</h2>
        <span className="alt-view-sub mono dim">~/.forge/config.json</span>
      </div>
      <div className="alt-view-body">
        <div className="settings-list">
          {rows.map((r, i) => (
            <div key={i} className="settings-row">
              <span className="settings-k">{r.k}</span>
              <span className="settings-v mono">{r.v}</span>
              <button className="btn-ghost">{r.action}</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, {
  IssueListPanel, RightPanel,
  OrchestratorView, SpecsLibraryView, PluginsView, SettingsView,
  AgentCard, OrchCard, MiniTerm,
});
