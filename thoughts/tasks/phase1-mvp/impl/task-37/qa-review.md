# Task 37 QA Review
Verdict: ✅ Approved

## Strengths
- Previous QA blockers are fixed end-to-end:
  - **Semantic list structure:** `Connections` renders as `<ul className="auth-list">` with each `AuthRow` as a `<li className="auth-row">`. ([right-panel.tsx](/Users/alvarocarvalho/desenv/personal/forge/src/renderer/components/right-panel.tsx), [auth-row.tsx](/Users/alvarocarvalho/desenv/personal/forge/src/renderer/components/auth-row.tsx))
  - **List styling reset:** `.auth-list` now resets browser defaults (`list-style: none; margin: 0; padding: 0;`), preventing bullets/indent regressions in Electron/Chromium. ([tokens.css](/Users/alvarocarvalho/desenv/personal/forge/src/renderer/styles/tokens.css))
  - **Valid `<li>` test wrappers:** direct `AuthRow` / `ActivityRow` tests now render rows inside a `<ul>`, keeping DOM validity. ([right-panel.test.tsx](/Users/alvarocarvalho/desenv/personal/forge/tests/renderer/right-panel.test.tsx))
- Accessibility/testing posture is good for Phase 1:
  - list semantics are asserted via roles (`list`/`listitem`) without over-coupling to class selectors. ([right-panel.test.tsx](/Users/alvarocarvalho/desenv/personal/forge/tests/renderer/right-panel.test.tsx))
  - connection state is conveyed both visually and via `StatusDot`’s `role="img"` + `aria-label={state}` contract. ([status-dot.tsx](/Users/alvarocarvalho/desenv/personal/forge/src/renderer/components/status-dot.tsx))
- Type safety and maintainability are solid: `AUTH_ROWS` is keyed by `keyof AuthStatus`, preventing auth-target drift at compile time. ([right-panel.tsx](/Users/alvarocarvalho/desenv/personal/forge/src/renderer/components/right-panel.tsx))

## Critical issues
None.

## Important issues
None.

## Minor issues
- `ActivityRow` is implemented as a `<li>` (good future-proofing for Phase 3), but `RightPanel`’s current activity placeholder is a `<div className="activity-list">`. This is fine in Phase 1 because `ActivityRow` isn’t rendered here yet; when the activity feed is wired, ensure `ActivityRow` is only rendered inside a real list container (`<ul>`/`<ol>`) and apply a similar list-style reset if `activity-list` becomes a list element. ([activity-row.tsx](/Users/alvarocarvalho/desenv/personal/forge/src/renderer/components/activity-row.tsx), [right-panel.tsx](/Users/alvarocarvalho/desenv/personal/forge/src/renderer/components/right-panel.tsx), [tokens.css](/Users/alvarocarvalho/desenv/personal/forge/src/renderer/styles/tokens.css))

## Drift detected
- Beneficial drift vs the Task 37 plan sketch: the plan shows `auth-list`/`auth-row` as `<div>`s, but the implementation uses `<ul>/<li>` for semantic correctness and better a11y/testing. The required visual parity is preserved via the `.auth-list` default-style reset. ([plan Task 37](/Users/alvarocarvalho/desenv/personal/forge/thoughts/tasks/phase1-mvp/plans/2026-05-12-phase1-mvp.md:3942), [right-panel.tsx](/Users/alvarocarvalho/desenv/personal/forge/src/renderer/components/right-panel.tsx), [tokens.css](/Users/alvarocarvalho/desenv/personal/forge/src/renderer/styles/tokens.css))

## Assessment
Task 37 is in good shape: the earlier QA failures (semantic list structure, `auth-list` list-style reset, and valid `<li>` test wrappers) are resolved, the renderer tests are stable and role-driven, and the implementation remains small, typed, and Phase 1-faithful. ✅
