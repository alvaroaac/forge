# Task 34 QA Review
Verdict: ✅ Approved

## Strengths
- The previously failing test-quality concerns are addressed: `IssueCard` is mocked, and assertions are made against a stable, test-owned DOM (`data-testid`, `data-issue-id`, `data-is-active`, `data-has-spec`) rather than `IssueCard` internals. (`tests/renderer/issue-group.test.tsx:8-35`)
- Prop pass-through is now locked precisely:
  - `hasSpecFor` call count + call order are asserted (`toHaveBeenCalledTimes`, `toHaveBeenNthCalledWith`). (`tests/renderer/issue-group.test.tsx:206-228`)
  - `onOpen` is exercised via mock-owned buttons, with exact call counts and nth-call argument assertions. (`tests/renderer/issue-group.test.tsx:230-262`)
- Row splitting behavior is covered for both even and odd lengths, including the odd-length “first row gets the extra item” case. (`tests/renderer/issue-group.test.tsx:127-179`)
- Component implementation remains small, typed, and straightforward; `intoRows` is isolated and keeps complexity low. (`src/renderer/components/issue-group.tsx:21-27, 37-69`)

## Critical issues
None.

## Important issues
None.

## Minor issues
- **Type-only import clarity:** `Group` is a type-only export (`export type Group = ...`), so prefer `import type { Group } from '../lib/classify'` for consistency with `isolatedModules` style and to make intent explicit. (`src/renderer/lib/classify.ts:3`, `src/renderer/components/issue-group.tsx:6`)
- **Semantics/a11y nit:** `IssueGroup` uses a `<section>` without an accessible name/heading. If you intend this to be a named region, consider `aria-labelledby` pointing at the visible group name (or switch to a `<div>` if it’s purely structural). (`src/renderer/components/issue-group.tsx:42-48`)
- **Test ergonomics nit:** the tests use `container.querySelectorAll(...)` for most lookups; swapping to Testing Library queries (e.g. `getAllByTestId('issue-card')`) would improve failure messages, but this is not a correctness issue. (`tests/renderer/issue-group.test.tsx:105-125, 140-152`)

## Drift detected
- No concerning drift. The local `META` duplication is plan-requested for Task 34 and does not introduce a concrete bug here. (`thoughts/tasks/phase1-mvp/plans/2026-05-12-phase1-mvp.md:3577-3582`, `src/renderer/components/issue-group.tsx:14-19`)

## Assessment
Task 34 is ready to land: the component matches the plan’s intended structure and contract, and the test suite now behaves like a true unit test for `IssueGroup` (mocked `IssueCard`, stable assertions, strict call counts, and explicit odd-length row coverage). The remaining notes are minor readability/semantics cleanups, not blockers.
