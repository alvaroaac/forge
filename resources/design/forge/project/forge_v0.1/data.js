// Sample data for Forge dashboard prototype
window.FORGE_DATA = {
  lastSync: "12s ago",

  auth: [
    { id: "claude", name: "Claude Code",    state: "connected", detail: "v1.18.2 · authed as colin@" },
    { id: "codex",  name: "Codex CLI",      state: "connected", detail: "v0.9.4 · authed as colin@" },
    { id: "linear", name: "Linear",         state: "connected", detail: "team ENG · last sync 12s ago" },
  ],

  activity: [
    { id: "ENG-142", text: "Spec generated",        ts: "3m ago",  kind: "spec" },
    { id: "ENG-138", text: "Agent finished",        ts: "1h ago",  kind: "agent" },
    { id: "ENG-136", text: "Issue synced from Linear", ts: "2h ago", kind: "sync" },
    { id: "ENG-131", text: "Spec approved",         ts: "4h ago",  kind: "approve" },
  ],

  agents: [
    {
      id: "ag_01",
      type: "Claude Code",
      issueId: "ENG-138",
      status: "running",
      elapsed: "4m 12s",
      output: "› refactor schema.prisma — adding session_token table…",
      worktree: "~/wt/forge-eng138",
      branch: "eng-138/bulk-archive",
      model: "sonnet-4.5",
    },
    {
      id: "ag_02",
      type: "Codex CLI",
      issueId: "ENG-131",
      status: "running",
      elapsed: "12m 47s",
      output: "› wiring Cmd+K palette into RootLayout.tsx",
      worktree: "~/wt/forge-eng131",
      branch: "eng-131/cmdk-palette",
      model: "gpt-5-codex",
    },
    {
      id: "ag_03",
      type: "Claude Code",
      issueId: "ENG-140",
      status: "review",
      elapsed: "2m ago",
      output: "✓ patch ready — awaiting review on auth/callback.ts",
      worktree: "~/wt/forge-eng140",
      branch: "eng-140/oauth-callback",
      model: "opus-4.1",
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
    { id: "ENG-141", title: "Roll out billing v2 feature flag",              group: "Urgent", label: "billing", priority: "urgent", status: "todo", specStatus: "generated" },
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

  // detail + spec content keyed by issue id (extra content only for highlighted issues)
  specs: {
    "ENG-142": {
      description: `Refresh tokens are expiring mid-session for ~3% of users, forcing a hard re-auth. Sentry shows the failure clustered on concurrent tab activity — two refresh calls race and discard the rotated token.\n\nReported by @maya in #eng-bugs. Repro: open two tabs, idle 14m, focus tab B, attempt any authed action.`,
      comments: [
        { author: "maya",  ts: "4h ago", text: "Hitting this consistently on staging. Logs attached in Linear." },
        { author: "colin", ts: "2h ago", text: "Probably the rotation lock we discussed in the auth refactor doc. Bumping to urgent." },
      ],
      spec: {
        sections: [
          { h: "Task Summary",
            body: "Eliminate the refresh-token race in `auth/refresh.ts`. Two concurrent calls overlap, the second receives an already-rotated token, and the session falls back to the unauthenticated state. Goal: serialize refresh per session and make the resolution observable to consumers." },
          { h: "Context",
            body: "• `apps/web/src/auth/refresh.ts` — token rotation entry point\n• `packages/auth-core/session.ts` — session state machine, has an unused `_refreshLock` field\n• `CLAUDE.md §3 — Auth Flow` calls out rotation semantics and forbids polling\n• `thoughts/auth-refactor-2026-Q1.md` — decision record: rotating refresh tokens, single-flight guarantee" },
          { h: "Suggested Approach",
            body: "1. Add per-session refresh lock in `session.ts` using a promise-chained single-flight\n2. Expose refresh state as an observable so consumers subscribe instead of polling\n3. Integration test `auth-core/__tests__/refresh-race.spec.ts` triggering 2 concurrent calls + assert one network round-trip\n4. Ship behind `auth.refresh.lock` flag — ramp 1% → 25% → 100% over 48h" },
          { h: "Open Questions",
            body: "• Should refresh failures surface to the UI, or silently retry once before logout?\n• Telemetry signal to confirm landing — do we have a `auth.refresh.race` counter, or do we need to add one?\n• Is the same race possible in the mobile RN client? `auth-core` is shared." },
        ],
      },
    },
  },
};
