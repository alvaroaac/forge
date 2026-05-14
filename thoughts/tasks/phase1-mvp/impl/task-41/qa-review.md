# Task 41 QA Review

## Verdict
✅ Approved

## Strengths
- Clean, low-complexity composition and clear controlled-tab contract (`tab` prop + `setTab`), consistent with recent renderer components. (`src/renderer/components/spec-drawer.tsx:40-116`)
- Escape-to-close is correctly encapsulated and cleaned up on unmount (no listener leaks), and the unit test explicitly locks the cleanup behavior. (`src/renderer/components/spec-drawer.tsx:24-38`, `tests/renderer/spec-drawer.test.tsx:84-106`)
- Shell behavior is robust: scrim + drawer always render, but content only renders when `issue` is non-null; tests lock both “closed shell” and “open classes + header” states. (`src/renderer/components/spec-drawer.tsx:53-60,57-59,59-113`, `tests/renderer/spec-drawer.test.tsx:40-61,63-82`)
- Outbound Linear link uses the correct anchor semantics (`<a href ... target="_blank" rel="noreferrer">`) rather than an inert button, matching the plan delta. (`src/renderer/components/spec-drawer.tsx:75-77`)

## Critical issues
None.

## Important issues
None.

## Minor issues
- **Icon-only close button naming consistency:** the close control relies on `title="Close (Esc)"` for its accessible name rather than the more consistent `aria-label` pattern used by other icon buttons (e.g. Refresh/Settings). This still yields an accessible name, but it’s slightly inconsistent with the renderer’s recent a11y posture. (`src/renderer/components/spec-drawer.tsx:65`, compare `src/renderer/components/issue-list-panel.tsx:77-85`, `src/renderer/components/top-bar.tsx:46-48`)
- **Escape handler fires even when the drawer is closed:** `useEscClose(onClose)` is installed regardless of `issue !== null`, so pressing Escape anywhere in the app will call `onClose()` even when no issue is selected. Likely harmless (idempotent close), but worth noting as future composition surface when other Escape-driven UI appears. (`src/renderer/components/spec-drawer.tsx:24-38,51-53`)
- **Drawer tabs don’t expose selected state via ARIA:** unlike `PillTab`’s `aria-pressed` selected signal, the drawer tab buttons currently rely only on CSS classes. Not a blocker for Phase 1, but a small a11y consistency improvement. (`src/renderer/components/spec-drawer.tsx:79-94`, compare `src/renderer/components/pill-tab.tsx:10-20`)
- **Test intent wording vs controlled component behavior:** the test named “marks the active tab only” asserts the active class remains on “Spec” after clicking “Detail” because the component is controlled and the test doesn’t rerender with the new `tab` prop. The behavior is correct; the test title is just a touch misleading. (`tests/renderer/spec-drawer.test.tsx:129-149`)
- **Potential React key collision edge case:** `issue.labels.map(...)` uses the label string as the React key; if the upstream data ever contains duplicates, React will warn. Probably fine with Linear labels, but it’s a small footgun. (`src/renderer/components/spec-drawer.tsx:71-73`)

## Drift call-outs vs prior tasks
- Mild a11y drift: recent renderer tasks established “icon-only buttons get explicit `aria-label`” (Task 35/36 patterns). `SpecDrawer`’s close button currently uses only `title` for naming. This is not a functional regression, but it’s a consistency gap. (`src/renderer/components/spec-drawer.tsx:65`, `src/renderer/components/issue-list-panel.tsx:77-85`, `src/renderer/components/top-bar.tsx:46-48`, `thoughts/tasks/phase1-mvp/impl/task-35/qa-review.md:5-7`)
- Mild tab-state drift: `PillTab` exposes selected state via `aria-pressed`; `SpecDrawer` tabs do not. (`src/renderer/components/pill-tab.tsx:10-20`, `src/renderer/components/spec-drawer.tsx:79-94`)

## Assessment
`SpecDrawer` is small, readable, and consistent with the Phase 1 renderer composition/security posture (pure React nodes, no risky DOM injection), and it correctly cleans up global event listeners. Tests cover the meaningful behaviors (shell/visibility, Esc close + cleanup, tab switching calls, composed body switching, labels, outbound link attributes).

No Critical/Important issues remain in the reviewed scope. ✅

