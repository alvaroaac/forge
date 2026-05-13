// Forge — Spec Review screen data
// Self-contained: the review screen doesn't depend on the full dashboard data.
window.FORGE_REVIEW = {
  user: { handle: "colin", repo: "humanlayer/riptide", branch: "main" },

  issue: {
    id: "ENG-142",
    title: "Fix auth token expiry on refresh race",
    group: "Bugs",
    label: "auth",
    priority: "urgent",
    status: "todo",
    url: "https://linear.app/humanlayer/issue/ENG-142",
  },

  spec: {
    path: "thoughts/tasks/eng-142/initial-spec.md",
    lines: 64,
    generated: "3m ago",
    savedAt: "2s ago",
    model: "sonnet-4.5",
    tokens: "8.4k",
    status: "draft",
  },

  // Markdown source — single source of truth.
  // Renderer parses this for read/split views; editor displays it verbatim.
  source: `# Spec: ENG-142 — Fix auth token expiry on refresh race

> **Status:** Draft · awaiting approval
> **Generated:** 3m ago · sonnet-4.5 · 8,412 tokens
> **Issue:** https://linear.app/humanlayer/issue/ENG-142

---

## Task Summary

Eliminate the refresh-token race in \`auth/refresh.ts\`. Two concurrent
calls overlap, the second receives an already-rotated token, and the
session silently falls back to unauthenticated state.

Goal: serialize refresh per-session and make resolution observable to
consumers. Affects ~3% of WAU based on the \`auth.refresh.race\` Sentry
cluster, last 14d.

---

## Context

- \`apps/web/src/auth/refresh.ts\` — token rotation entry point
- \`packages/auth-core/session.ts\` — session state machine; has an
  unused \`_refreshLock\` field from the 2026-Q1 refactor that was
  scoped but never wired up
- \`CLAUDE.md §3 — Auth Flow\` calls out rotation semantics and
  forbids polling
- \`thoughts/auth-refactor-2026-Q1.md\` — decision record: rotating
  refresh tokens with single-flight guarantee
- React Native client shares \`auth-core\`; same race is theoretically
  reachable but harder to reproduce

The \`_refreshLock\` field exists because @maya scoped it during the
refactor and it was punted to a follow-up that never landed.

---

## Suggested Approach

1. Implement per-session refresh lock in \`session.ts\` using a
   promise-chained single-flight — one in-flight refresh, callers
   await the same promise.
2. Expose refresh state as an observable (\`session.refreshing$\`) so
   consumers subscribe instead of polling.
3. Integration test at \`auth-core/__tests__/refresh-race.spec.ts\` —
   trigger 2 concurrent calls, assert exactly one network round-trip.
4. Ship behind \`auth.refresh.lock\` flag — ramp 5% → 25% → 100%
   over 48h, monitoring \`auth.refresh.race\` counter.
5. [added] RN client: confirm watchdog timer in
   \`mobile/src/auth/keepalive.ts\` does not fire mid-refresh and
   double-trigger. Add guard if needed.

---

## Open Questions

- [ ] Should refresh failures surface to the UI, or silently retry
      once before logout?
- [ ] Telemetry signal to confirm landing — is there an
      \`auth.refresh.race\` counter already, or do we add one?
- [ ] Same race possible in the mobile RN client? \`auth-core\` shared.
- [ ] [added] RN watchdog timer: confirm interaction with single-flight.
`,

  // Comment threads, anchored to section ids
  threads: {
    summary: [
      {
        id: "th1",
        anchor: "Task Summary",
        resolved: false,
        history: [
          { author: "colin",  ts: "12m ago", text: "Spec should mention the RN client too — auth-core is shared. The race is theoretical there but worth a sentence." },
          { author: "claude", ts: "11m ago", text: "Added a note in Open Questions (§4). Want me to expand Suggested Approach with an RN-specific step?" },
          { author: "colin",  ts: "10m ago", text: "Yes — and call out the watchdog timer we use in mobile-only contexts (mobile/src/auth/keepalive.ts)." },
        ],
      },
    ],
    approach: [
      {
        id: "th2",
        anchor: "Suggested Approach · step 4",
        resolved: false,
        history: [
          { author: "colin", ts: "6m ago", text: "Start the ramp at 5%, not 1%. 1% is too small to detect regression in 24h with our traffic shape." },
        ],
      },
      {
        id: "th3",
        anchor: "Suggested Approach · websocket path",
        resolved: true,
        history: [
          { author: "colin",  ts: "20m ago", text: "Do we need a fallback for the websocket path? It does its own auth dance." },
          { author: "claude", ts: "19m ago", text: "No — websocket auth piggybacks the same session token. Single-flight covers it. Resolving." },
        ],
      },
    ],
    questions: [
      {
        id: "th4",
        anchor: "Open Questions · telemetry",
        resolved: false,
        history: [
          { author: "colin", ts: "1m ago", text: "We added auth.refresh.race in March — check the metrics-schema package before adding a new one." },
        ],
      },
    ],
  },

  // Save history — shown in the status bar pop / autosave tooltip
  saveLog: [
    { ts: "2s ago",  by: "@colin",  what: "edited §3 step 4 (5% ramp)" },
    { ts: "1m ago",  by: "@claude", what: "regenerated §3 with RN step" },
    { ts: "11m ago", by: "@claude", what: "added open question (§4) on RN client" },
    { ts: "3m ago",  by: "system",  what: "spec generated · 64 lines" },
  ],
};
