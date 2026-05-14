# Task 36 QA Review
Verdict: ✅ Approved

## Strengths
- `TopBar` is small, typed, and keeps complexity low with a single `AUTH_SOURCES` mapping and a straightforward render loop. (`src/renderer/components/top-bar.tsx:5-52`)
- Good button semantics: the Settings control is a real `<button>` with `type="button"` and an accessible name via `aria-label`. (`src/renderer/components/top-bar.tsx:46-48`, `tests/renderer/top-bar.test.tsx:62-67`)
- Status rendering is aligned with the established `StatusDot` accessibility contract (`role="img"`, `aria-label={state}`), and the test asserts the correct connected/disconnected counts. (`src/renderer/components/status-dot.tsx:21-33`, `tests/renderer/top-bar.test.tsx:36-41`)

## Critical issues
None.

## Important issues
None.

## Minor issues
- **Test coupling to CSS/DOM structure:** the order assertion is implemented by querying `.auth-pill` and `.auth-pill-name` via `container.querySelectorAll(...)`. This is a bit more brittle than recent renderer test posture (Tasks 33–35) that prefers role/name queries or stable test-owned selectors. A small markup change (e.g. renaming a class or wrapping text) would break the test without changing user-visible behavior. (`tests/renderer/top-bar.test.tsx:28-35`)
  - Concrete fix: expose a stable, non-styling hook for tests (e.g. `data-testid="auth-pill"` on each pill and `data-auth-key` for ordering), then query with `screen.getAllByTestId(...)` and assert `[...].map(el => el.getAttribute('data-auth-key'))`. Alternatively, render the pills as a semantic list (`<ul>/<li>`) and assert order via `getAllByRole('listitem')` + text, but that’s a markup change.
- **No-op Settings button UX/a11y nuance:** the Settings button is focusable/clickable but intentionally does nothing in Phase 1. That’s spec-faithful, but it can be confusing for keyboard and screen-reader users because it presents an actionable control with no effect. (`src/renderer/components/top-bar.tsx:46-48`, `tests/renderer/top-bar.test.tsx:59-67`)
  - Concrete fix: either (1) disable it (`disabled` + `aria-disabled` as appropriate) and visually reflect disabled styling, or (2) wire it to a minimal non-invasive affordance (e.g. open a placeholder dialog/toast) that clearly communicates “Settings ships in Phase 5”, while keeping the structure stable.
- **Semantics nit:** the outer wrapper is a plain `<div className="topbar">`. Consider using a landmark element like `<header>` for clearer page structure. This is optional and shouldn’t block Phase 1, but it’s a low-effort accessibility win. (`src/renderer/components/top-bar.tsx:24`)

## Drift detected
- Minor drift from the plan’s sketch: the plan example uses `title="Settings"`, while the implementation uses `aria-label="Settings"` plus `type="button"`. This is beneficial drift and matches the renderer accessibility direction established in Tasks 32 and 35. (`thoughts/tasks/phase1-mvp/plans/2026-05-12-phase1-mvp.md:3843-3924`, `src/renderer/components/top-bar.tsx:46-48`)
- Testing style drift: Task 36’s test uses CSS selectors (`.auth-pill`, `.auth-pill-name`) for key assertions, whereas recent renderer QA guidance has been to prefer role/name queries over brittle structure. Not a blocker here, but worth aligning before the renderer suite grows. (`tests/renderer/top-bar.test.tsx:28-35`, `thoughts/tasks/phase1-mvp/impl/task-35/qa-review.md:10`)

## Assessment
Task 36 looks solid and consistent with the Phase 1 plan: typed props, fixed auth order/labels, boolean-derived status mapping, and correct Settings button semantics. The main improvement area is test robustness (reduce reliance on CSS/DOM internals) and, secondarily, clarifying the intentional no-op Settings behavior for accessibility/UX.
