# Task 37 Spec Review
Verdict: ✅ Spec compliant

## Missing requirements
None found.

## Extras / scope drift
None found. Phase 2 UI controls are intentionally absent (no `New Agent`, no `AgentCard`, no `Logs`/`Manage` affordances), and the activity section remains placeholder-only for Phase 1.

## Misunderstandings
None found.

## Addendum-rule check
Protected/reference directories called out by the addendum (`.agents/`, `thoughts/`, `resources/design/`, `scripts/orchestrator-core/`) were not rewritten as part of Task 37. The recorded Task 37 commits touch only the expected renderer components, the focused renderer test, `tokens.css` for the semantic list reset, and the Task 37 progress artifact:

- `59961c70fbc5f57cf1cf876734f766c7618af095`: `src/renderer/components/{right-panel,auth-row,activity-row}.tsx`, `tests/renderer/right-panel.test.tsx`, `thoughts/tasks/phase1-mvp/impl/task-37/progress.md`
- `d75a6f4`: `src/renderer/components/{right-panel,auth-row,activity-row}.tsx`, `tests/renderer/right-panel.test.tsx`, `thoughts/tasks/phase1-mvp/impl/task-37/progress.md`
- `be206e04333a60b6e8304e708a234c93f031bb60`: `src/renderer/styles/tokens.css`, `tests/renderer/right-panel.test.tsx`, `thoughts/tasks/phase1-mvp/impl/task-37/progress.md`

## Tech-debt-accounting check
Progress reports “Tech-debt logged: None added.” No missing Task 37 requirements were found that should have been captured as tech-debt.

Progress materially records substantive implementation commits (the feature commit plus follow-up QA fixes). Per reviewer instructions: do not fail for omission of the later docs-only progress commit `a0b7cbc`.

## Evidence
- Plan requirements (Task 37 deltas): AuthRow name/state props + empty `auth-detail` placeholder; Activity section placeholder-only; Running agents empty state + Phase 1 message; `RightPanel` props are `{ auth: AuthStatus }` only. ([thoughts/tasks/phase1-mvp/plans/2026-05-12-phase1-mvp.md](/Users/alvarocarvalho/desenv/personal/forge/thoughts/tasks/phase1-mvp/plans/2026-05-12-phase1-mvp.md:3942))

- AuthRow:
  - Props are `name` and `state` only; uses `StatusDot`; renders name; renders an empty `.auth-detail.mono`; state text uses connected/disconnected color. ([src/renderer/components/auth-row.tsx](/Users/alvarocarvalho/desenv/personal/forge/src/renderer/components/auth-row.tsx:3))
  - Semantic list item is used post-QA: `<li className="auth-row">…</li>`. ([auth-row.tsx](/Users/alvarocarvalho/desenv/personal/forge/src/renderer/components/auth-row.tsx:9))

- ActivityRow:
  - Props are `id`, `text`, `ts`; classnames preserve the prototype’s visual shape hooks (`activity-row`, `activity-id`, `activity-text`, `activity-ts`). ([src/renderer/components/activity-row.tsx](/Users/alvarocarvalho/desenv/personal/forge/src/renderer/components/activity-row.tsx:1))
  - Semantic list item is used post-QA: `<li className="activity-row">…</li>`. ([activity-row.tsx](/Users/alvarocarvalho/desenv/personal/forge/src/renderer/components/activity-row.tsx:8))

- RightPanel:
  - Props are exactly `{ auth: AuthStatus }`. Connections derive from booleans for Claude Code/Codex CLI/Linear. ([src/renderer/components/right-panel.tsx](/Users/alvarocarvalho/desenv/personal/forge/src/renderer/components/right-panel.tsx:9))
  - Activity section is placeholder-only (“No activity yet.”) and does not render any ActivityRow in Phase 1. ([right-panel.tsx](/Users/alvarocarvalho/desenv/personal/forge/src/renderer/components/right-panel.tsx:26))
  - Running agents empty state matches plan intent and includes the Phase 1 message; no Phase 2 controls are present. ([right-panel.tsx](/Users/alvarocarvalho/desenv/personal/forge/src/renderer/components/right-panel.tsx:39))

- Design classes + auth-list reset:
  - Uses `panel-right`, `rp-section`, `rp-section-grow`, `rp-h`, `auth-list`, `activity-list`, `empty`, `empty-agents` classes as required. ([right-panel.tsx](/Users/alvarocarvalho/desenv/personal/forge/src/renderer/components/right-panel.tsx:12))
  - `.auth-list` resets list defaults after `<ul>` semantics: `list-style: none; margin: 0; padding: 0;`. ([src/renderer/styles/tokens.css](/Users/alvarocarvalho/desenv/personal/forge/src/renderer/styles/tokens.css:384))

- Tests:
  - Covers connections ordering and list semantics via roles. ([tests/renderer/right-panel.test.tsx](/Users/alvarocarvalho/desenv/personal/forge/tests/renderer/right-panel.test.tsx:15))
  - Covers connected/disconnected derivation via `StatusDot` `aria-label`. ([right-panel.test.tsx](/Users/alvarocarvalho/desenv/personal/forge/tests/renderer/right-panel.test.tsx:33))
  - Covers activity placeholder and absence of activity rows. ([right-panel.test.tsx](/Users/alvarocarvalho/desenv/personal/forge/tests/renderer/right-panel.test.tsx:43))
  - Covers running agents empty state and guards absence of Phase 2 controls (`New Agent`, `Logs`, `Manage`). ([right-panel.test.tsx](/Users/alvarocarvalho/desenv/personal/forge/tests/renderer/right-panel.test.tsx:54))
