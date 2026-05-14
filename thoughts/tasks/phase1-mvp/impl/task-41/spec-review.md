# Task 41 Spec Review

## Verdict
✅ Spec compliant

## Missing requirements
None found.

## Extra scope
None that violates Task 41. The test suite includes additional coverage (close button, unmount cleanup, label/link assertions) beyond the plan’s minimum, but remains scoped to `SpecDrawer`.

## Misunderstandings
None found.

## Addendum-rule check
Compliant with tooling scope: Task 41 changes are limited to the owned component/test and the progress artifact; no evidence of repo-wide formatting/linting touching `.agents/`, `thoughts/`, `resources/design/`, or `scripts/orchestrator-core/` beyond the expected `thoughts/tasks/**/impl/` write. (See `thoughts/tasks/phase1-mvp/plans/2026-05-12-phase1-mvp.addendum.md` and Task 41 progress.)

## Tech-debt-accounting check
Compliant. `thoughts/tasks/phase1-mvp/impl/task-41/progress.md` explicitly reports “Tech-debt logged: None.” and includes the required execution evidence (files, tests, commit, self-review).

## Evidence
- New `SpecDrawer` component exists and exports `DrawerTab = 'detail' | 'spec'`: `src/renderer/components/spec-drawer.tsx:10`.
- Scrim + aside shell always render; open classes are driven by `issue !== null`; content renders only when `issue` is non-null: `src/renderer/components/spec-drawer.tsx:53-60`, `57-59`, `112-113`.
- Header includes id/title/close button (with `Close (Esc)` title), plus priority chip, all labels, and Linear outbound anchor with `target="_blank"` + `rel="noreferrer"`: `src/renderer/components/spec-drawer.tsx:61-78` (labels map at `71-73`, anchor at `75-77`).
- Prototype deltas respected:
  - No group chip / `groupMeta` lookup present in header: `src/renderer/components/spec-drawer.tsx:61-95`.
  - No spec-status dot in tabs; tabs are plain buttons with active class: `src/renderer/components/spec-drawer.tsx:79-94`.
- Local `useEscClose(onClose)` hook handles Escape and cleans up listener: `src/renderer/components/spec-drawer.tsx:24-38`, used at `51`.
- Tabs call `setTab('detail'|'spec')` and active class toggles based on `tab`: `src/renderer/components/spec-drawer.tsx:79-94`.
- Body composes `DetailTab` / `SpecTab` with required props: `src/renderer/components/spec-drawer.tsx:97-109`.
- Test file exists and verifies the core requirements (no content when `issue=null`, open classes, Esc-to-close + cleanup, tab switching + active class, label rendering, and anchor attributes): `tests/renderer/spec-drawer.test.tsx:40-61`, `63-82`, `84-106`, `129-149`, `186-208`.

