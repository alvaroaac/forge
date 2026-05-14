# Task 33 Spec Review
Verdict: ✅ Spec compliant
## Missing requirements
None.

## Extras / scope drift
- `src/renderer/styles/tokens.css` includes an affordance change for `.issue-card-main` hover/focus and a parent `.issue-card:has(...)` border-state. Task 33’s plan did not mention `tokens.css`, but this is directly tied to the “IssueCard affordance” expectation and does not expand product scope.

## Misunderstandings
None.

## Addendum-rule check
Pass. No evidence of formatting/linting rewrites in protected/reference directories (`.agents/`, `thoughts/` outside the allowed task artifacts, `resources/design/`, `scripts/orchestrator-core/`). Task outputs are confined to the expected implementation/test files plus the Task 33 artifacts described in `progress.md`.

## Tech-debt-accounting check
Pass. `thoughts/tasks/phase1-mvp/impl/task-33/progress.md` reports “None logged,” and no intentionally-skipped items are called out as needing an entry.

## Evidence
- Plan requirements (Task 33): `thoughts/tasks/phase1-mvp/plans/2026-05-12-phase1-mvp.md` (“Task 33: Renderer — classify lib + IssueCard”).
- `classifyGroup` precedence and case-insensitive exact label match:
  - Implementation: `src/renderer/lib/classify.ts` orders `isBug` > `priority === 'urgent'` > `labels.some(label.toLowerCase() === 'chore')` > default Feature.
  - Tests: `tests/renderer/classify.test.ts` covers Bugs-over-urgent precedence and mixed-case `"ChOrE"` label.
- `IssueCard` behavior:
  - Derives group via `classifyGroup(issue)` and uses typed `GROUP_COLOR: Record<Group, string>`: `src/renderer/components/issue-card.tsx`.
  - Renders only the first label (`issue.labels[0]`): `src/renderer/components/issue-card.tsx`; asserted by `tests/renderer/issue-card.test.tsx` (“renders only the first label...”).
  - Spec control is driven by `hasSpec` and renders `Spec` vs `View Spec`; no approved badge/specStatus UI exists: `src/renderer/components/issue-card.tsx`; asserted by `tests/renderer/issue-card.test.tsx` (“shows "View Spec" when hasSpec” and “does not retrigger…” with `hasSpec={false}` Spec button).
  - Main open control and sibling `Spec`/`Detail` actions route `onOpen(issue, ...)` without double-trigger: `src/renderer/components/issue-card.tsx` (main `<button className="issue-card-main">` plus sibling action buttons), and `tests/renderer/issue-card.test.tsx` asserts single-call behavior for Spec/Detail interactions.
- IssueCard affordance styling: `src/renderer/styles/tokens.css` sets `.issue-card-main` pointer/hover/focus styles and uses `.issue-card:has(.issue-card-main:hover|:focus-visible)` for border feedback, aligning the hover affordance with the actual interactive region.
- Progress / commits:
  - `thoughts/tasks/phase1-mvp/impl/task-33/progress.md` materially records implementation/testing work and repair commits; it explicitly notes TDD-first failures, focused Vitest runs, and the related commit IDs. Per reviewer guidance, it is acceptable that a later docs-only “edit the progress list itself” commit (e.g. `b86065c`) is not treated as a compliance failure.
