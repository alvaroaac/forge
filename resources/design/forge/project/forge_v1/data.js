// Forge v1.0 — sample data for the full product
window.FORGE_DATA = {
  user: { handle: "colin", repo: "humanlayer/riptide", branch: "main" },

  lastSync: "8s ago",
  costToday: { spend: "$4.21", tokens: "1.2M in · 184k out" },

  auth: [
    { id: "claude", name: "Claude Code",    state: "connected", detail: "v1.18.2 · authed as colin@" },
    { id: "codex",  name: "Codex CLI",      state: "connected", detail: "v0.9.4 · authed as colin@" },
    { id: "linear", name: "Linear",         state: "connected", detail: "team ENG · last sync 8s ago" },
    { id: "github", name: "GitHub",         state: "connected", detail: "humanlayer/riptide · token ok" },
  ],

  // skills/plugins installed (Phase 5 plugin system)
  skills: [
    { id: "linear",    name: "linear",       version: "1.4.2", state: "enabled" },
    { id: "orch",      name: "orchestrator", version: "0.8.0", state: "enabled" },
    { id: "thoughts",  name: "thoughts",     version: "0.3.1", state: "enabled" },
    { id: "review",    name: "qa-reviewer",  version: "0.2.0", state: "enabled" },
    { id: "release",   name: "release-bot",  version: "0.1.0", state: "disabled" },
  ],

  activity: [
    { id: "ENG-141", text: "Orchestrator finished · 3/3 sub-tasks merged", ts: "2m ago", kind: "orch-done" },
    { id: "ENG-142", text: "Spec generated · 152 lines",                   ts: "5m ago", kind: "spec" },
    { id: "ENG-138", text: "Patch ready · awaiting review",                ts: "12m ago", kind: "review" },
    { id: "ENG-136", text: "Issue synced from Linear",                     ts: "1h ago",  kind: "sync" },
    { id: "ENG-131", text: "Spec approved by @colin",                      ts: "3h ago",  kind: "approve" },
    { id: "ENG-128", text: "Agent timed out · auto-restarted",             ts: "5h ago",  kind: "warn" },
  ],

  agents: [
    {
      id: "ag_01",
      type: "Claude Code",
      issueId: "ENG-138",
      status: "running",
      elapsed: "4m 12s",
      worktree: "~/wt/forge-eng138",
      branch: "eng-138/bulk-archive",
      model: "sonnet-4.5",
      tokens: { in: "184k", out: "12.4k", spend: "$0.62" },
      role: "performer",
      // last N lines of stdout, rendered as a mini-terminal
      lines: [
        { kind: "out",   text: "› reading thoughts/conventions.md" },
        { kind: "out",   text: "› reading CLAUDE.md (§3 — Auth Flow)" },
        { kind: "tool",  text: "✎ edit  apps/web/src/components/Board.tsx  +42 −18" },
        { kind: "tool",  text: "⚙ run   pnpm typecheck" },
        { kind: "ok",    text: "✓ typecheck passed in 4.1s" },
        { kind: "out",   text: "› refactor schema.prisma — adding session_token table…" },
      ],
    },
    {
      id: "ag_02",
      type: "Codex CLI",
      issueId: "ENG-131",
      status: "running",
      elapsed: "12m 47s",
      worktree: "~/wt/forge-eng131",
      branch: "eng-131/cmdk-palette",
      model: "gpt-5-codex",
      tokens: { in: "412k", out: "38.9k", spend: "$1.84" },
      role: "performer",
      lines: [
        { kind: "out",  text: "› wiring Cmd+K palette into RootLayout.tsx" },
        { kind: "tool", text: "✎ new   apps/web/src/components/CmdPalette.tsx" },
        { kind: "tool", text: "⚙ run   pnpm test --filter cmd-palette" },
        { kind: "warn", text: "! 2 tests need updating — fixture has stale shape" },
        { kind: "out",  text: "› patching fixtures/cmdk.json…" },
        { kind: "out",  text: "$ _" },
      ],
    },
    {
      id: "ag_03",
      type: "Claude Code",
      issueId: "ENG-140",
      status: "review",
      elapsed: "2m ago",
      worktree: "~/wt/forge-eng140",
      branch: "eng-140/oauth-callback",
      model: "opus-4.1",
      tokens: { in: "291k", out: "21.7k", spend: "$1.09" },
      role: "performer",
      lines: [
        { kind: "ok",   text: "✓ all tests green (47/47)" },
        { kind: "tool", text: "⚙ run   git diff --stat" },
        { kind: "out",  text: "  auth/callback.ts  | 18 ++++++---" },
        { kind: "out",  text: "  auth/__tests__    | 42 ++++++++++++" },
        { kind: "ok",   text: "✓ patch ready — awaiting review on auth/callback.ts" },
      ],
    },
  ],

  // Active orchestration — parent issue with sub-agents (Phase 4)
  orchestrations: [
    {
      id: "orch_01",
      issueId: "ENG-141",
      title: "Roll out billing v2 feature flag",
      status: "running",
      elapsed: "18m 04s",
      progress: { done: 2, total: 4 },
      worktree: "~/wt/forge-eng141",
      branch: "eng-141/billing-v2",
      subtasks: [
        { id: "t1", title: "Audit billing.v1 callsites",            status: "done",     agent: "Claude Code", elapsed: "3m 12s" },
        { id: "t2", title: "Add v2 flag gate to checkout flow",     status: "done",     agent: "Codex CLI",   elapsed: "5m 48s" },
        { id: "t3", title: "Migrate subscription webhooks",         status: "running",  agent: "Claude Code", elapsed: "4m 02s",
          line: "› patching server/webhooks/stripe.ts (3 of 7)…" },
        { id: "t4", title: "Roll-out plan + monitoring dashboard",  status: "queued",   agent: "Claude Code", elapsed: null },
      ],
    },
  ],

  // group: Bugs | Urgent | Feature | Chore
  // priority: urgent | high | med | low
  // status: todo | in-progress | in-review | done
  // specStatus: none | generated | approved
  issues: [
    // --- Bugs ---
    { id: "ENG-142", title: "Fix auth token expiry on refresh race", group: "Bugs", label: "auth",    priority: "urgent", status: "todo", specStatus: "generated" },
    { id: "ENG-139", title: "Null ptr on profile load when avatar missing", group: "Bugs", label: "web", priority: "high", status: "todo", specStatus: "none" },
    { id: "ENG-137", title: "Webhook retries stack overflow under load",    group: "Bugs", label: "infra", priority: "high", status: "todo", specStatus: "none" },
    { id: "ENG-133", title: "Date picker drops timezone on submit",          group: "Bugs", label: "web", priority: "med", status: "todo", specStatus: "none" },
    { id: "ENG-128", title: "Memory leak in dashboard poll loop",            group: "Bugs", label: "web", priority: "high", status: "todo", specStatus: "approved" },

    // --- Urgent ---
    { id: "ENG-141", title: "Roll out billing v2 feature flag",              group: "Urgent", label: "billing", priority: "urgent", status: "in-progress", specStatus: "approved" },
    { id: "ENG-140", title: "Migrate legacy OAuth callback path",            group: "Urgent", label: "auth",    priority: "urgent", status: "in-review", specStatus: "approved" },

    // --- Feature ---
    { id: "ENG-138", title: "Bulk archive on board view",                    group: "Feature", label: "web",     priority: "med", status: "in-progress", specStatus: "approved" },
    { id: "ENG-136", title: "Inline assignee picker on issue cards",         group: "Feature", label: "web",     priority: "low", status: "todo", specStatus: "none" },
    { id: "ENG-135", title: "Saved filters per project",                     group: "Feature", label: "web",     priority: "low", status: "todo", specStatus: "none" },
    { id: "ENG-131", title: "Keyboard shortcut palette",                     group: "Feature", label: "web",     priority: "med", status: "in-progress", specStatus: "approved" },

    // --- Chore ---
    { id: "ENG-130", title: "Upgrade Prisma to 6.2",                         group: "Chore", label: "infra",     priority: "low", status: "todo", specStatus: "none" },
    { id: "ENG-129", title: "Remove unused i18n keys",                       group: "Chore", label: "web",       priority: "low", status: "todo", specStatus: "none" },
  ],

  // Spec detail per issue — extended with inline comment threads + thread history
  specs: {
    "ENG-142": {
      description: `Refresh tokens are expiring mid-session for ~3% of users, forcing a hard re-auth. Sentry shows the failure clustered on concurrent tab activity — two refresh calls race and discard the rotated token.\n\nReported by @maya in #eng-bugs. Repro: open two tabs, idle 14m, focus tab B, attempt any authed action.`,
      comments: [
        { author: "maya",  ts: "4h ago", text: "Hitting this consistently on staging. Logs attached in Linear." },
        { author: "colin", ts: "2h ago", text: "Probably the rotation lock we discussed in the auth refactor doc. Bumping to urgent." },
      ],
      spec: {
        meta: { path: "thoughts/tasks/eng-142/initial-spec.md", lines: 152, generated: "3m ago", model: "sonnet-4.5", tokens: "8.4k" },
        sections: [
          {
            id: "summary",
            h: "Task Summary",
            body: "Eliminate the refresh-token race in `auth/refresh.ts`. Two concurrent calls overlap, the second receives an already-rotated token, and the session falls back to the unauthenticated state. Goal: serialize refresh per session and make the resolution observable to consumers.",
            threads: [
              {
                id: "th1",
                resolved: false,
                history: [
                  { author: "colin", ts: "12m ago", text: "Spec should mention RN client too — we share auth-core." },
                  { author: "claude", ts: "11m ago", text: "Added a note in Open Questions §4. Want me to expand the Suggested Approach with an RN-specific section?" },
                  { author: "colin", ts: "10m ago", text: "Yes — and call out the watchdog timer we use in mobile-only contexts." },
                ],
              },
            ],
          },
          {
            id: "context",
            h: "Context",
            body: "• `apps/web/src/auth/refresh.ts` — token rotation entry point\n• `packages/auth-core/session.ts` — session state machine, has an unused `_refreshLock` field\n• `CLAUDE.md §3 — Auth Flow` calls out rotation semantics and forbids polling\n• `thoughts/auth-refactor-2026-Q1.md` — decision record: rotating refresh tokens, single-flight guarantee",
            threads: [],
          },
          {
            id: "approach",
            h: "Suggested Approach",
            body: "1. Add per-session refresh lock in `session.ts` using a promise-chained single-flight\n2. Expose refresh state as an observable so consumers subscribe instead of polling\n3. Integration test `auth-core/__tests__/refresh-race.spec.ts` triggering 2 concurrent calls + assert one network round-trip\n4. Ship behind `auth.refresh.lock` flag — ramp 1% → 25% → 100% over 48h",
            threads: [
              {
                id: "th2",
                resolved: false,
                history: [
                  { author: "colin", ts: "6m ago", text: "Step 4 — let's start the ramp at 5%, not 1%. 1% is too small to detect regression in 24h." },
                ],
              },
              {
                id: "th3",
                resolved: true,
                history: [
                  { author: "colin", ts: "20m ago", text: "Do we need a fallback for the websocket path?" },
                  { author: "claude", ts: "19m ago", text: "No — websocket auth piggybacks the same session token, single-flight covers it. Resolving." },
                ],
              },
            ],
          },
          {
            id: "questions",
            h: "Open Questions",
            body: "• Should refresh failures surface to the UI, or silently retry once before logout?\n• Telemetry signal to confirm landing — do we have a `auth.refresh.race` counter, or do we need to add one?\n• Is the same race possible in the mobile RN client? `auth-core` is shared.\n• [added] RN watchdog timer: confirm it doesn't fire mid-refresh and double-trigger.",
            threads: [],
          },
        ],
      },
    },
  },
};
