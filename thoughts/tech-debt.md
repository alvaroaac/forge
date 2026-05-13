# Tech Debt & Post-MVP Backlog

Running log of deferred ideas, known shortcuts, and post-MVP features. Add entries here instead of leaving TODOs in code.

---

## Deferred Features

### Spec Review — Comment Thread History

Thread history in the spec review screen. Each comment thread anchored to a block should have a history of past exchanges with Claude, allowing the user to see how the spec evolved.

- Deferred from: dashboard design session (2026-05-12)
- Complexity: requires persisting thread state per spec per block

### Spec Review — Per-section Regeneration

Currently "Submit Comments" triggers a full spec regeneration. Per-section regeneration (only rewrite the section the comment is anchored to) would be faster and less disruptive.

- Deferred from: dashboard design session (2026-05-12)

### Agent Cards — Live Output

Agent cards in the right panel show only status in v0.1. Final version should stream the last N lines of stdout from the running process.

- Deferred from: dashboard design session (2026-05-12)

### Group Color Borders on Issue Cards

v0.1 uses monochrome cards. Final design adds a left border color per group (red = bugs, amber = urgent, indigo = feature).

- Deferred from: dashboard design session (2026-05-12)

### Agent Session Drawer

Dedicated drawer for managing a running agent session — output tail, kill button, status history.

- Deferred from: dashboard design session (2026-05-12)

---

### Spec Generation Prompt

Phase 1 prompt is minimal (system instruction + CLAUDE.md + thoughts/ + issue → spec template). Should be refined with: better context selection (not all of thoughts/ blindly), few-shot examples, structured output enforcement, and possibly a two-pass approach (understand first, then write spec).

- Flagged from: Phase 1 tech spec review (2026-05-12)

---

## Known Shortcuts

_Add entries when you knowingly cut a corner during implementation._

- [2026-05-13][Task 1c] Playwright + Electron e2e not in CI. Reason: needs xvfb/display in GH Actions. Re-evaluate: Phase 2 when agent-spawn flows make manual e2e tedious.
- [2026-05-13][Task 1c] No Husky / pre-commit hooks. Reason: YAGNI for a single-developer Phase 1; CI gate is sufficient. Re-evaluate: Phase 5 packaging or when adding contributors.
- [2026-05-13][Task 1c] No Dependabot / Renovate config. Reason: low churn during Phase 1. Re-evaluate: Phase 5 productization.
