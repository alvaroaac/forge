# Task 36 Spec Review

Verdict: ✅ Spec compliant

## Missing requirements

None found.

## Extras / scope drift

- The plan’s example `TopBar` shows a Settings button with `title="Settings"`; the implementation uses `type="button"` plus `aria-label="Settings"` (stronger accessibility and button semantics) while remaining a Phase 1 no-op.

## Misunderstandings

None found.

## Addendum-rule check

- Addendum protected/reference dirs: no evidence of formatting/lint rewrites or edits under `.agents/`, `resources/design/`, or `scripts/orchestrator-core/`.
- Changes are scoped to the Task 36-owned files plus the allowed `thoughts/tasks/**/impl/` artifact update (progress). Commit `9d281ef8...` touches only:
  - `src/renderer/components/top-bar.tsx`
  - `tests/renderer/top-bar.test.tsx`
  - `thoughts/tasks/phase1-mvp/impl/task-36/progress.md`

## Tech-debt-accounting check

- Progress reports “Tech-debt logged: None added.” No skipped items are called out that would require an entry in `thoughts/tech-debt.md`.
- Progress includes a substantive implementation commit (`9d281ef848fedbbf7b8f0e070e7ee766e6c3be22`) and should not be penalized for omitting any later docs-only progress-edit commit (explicitly allowed by the review requirements).

## Evidence

- Plan Task 36 requires props `{ auth: AuthStatus, teamKey: string, lastSync: string }`, fixed auth list/order/labels (`Claude Code`, `Codex CLI`, `Linear` with keys `claudeCode`, `codex`, `linear`), boolean-derived StatusDot state, and Phase 1 settings no-op. See `thoughts/tasks/phase1-mvp/plans/2026-05-12-phase1-mvp.md` “Task 36: Renderer — `TopBar`”.
- Props & rendering:
  - `TopBarProps` exactly: `auth: AuthStatus; teamKey: string; lastSync: string;` in `src/renderer/components/top-bar.tsx`.
  - Brand/subline: renders `FORGE` and `v0.1 · {teamKey} team`.
  - Sync stamp: renders `last sync` and `lastSync` value.
  - Settings control: `<button type="button" ... aria-label="Settings">` with `<IconSettings size={14} />` and no click handler (no-op).
- Auth strip order/labels/keys + boolean mapping:
  - `AUTH_SOURCES` is ordered `claudeCode` → `codex` → `linear` with labels `Claude Code`, `Codex CLI`, `Linear`.
  - `StatusDot` state is derived via `auth[key] ? 'connected' : 'disconnected'`.
- Tests:
  - `tests/renderer/top-bar.test.tsx` asserts brand/team/sync presence.
  - Asserts auth pill order is exactly `['Claude Code', 'Codex CLI', 'Linear']` and that dot states match the boolean inputs via `aria-label="connected"/"disconnected"`.
  - Asserts Settings is a real `button` with accessible name “Settings”, has `type="button"`, and clicking does not throw.

