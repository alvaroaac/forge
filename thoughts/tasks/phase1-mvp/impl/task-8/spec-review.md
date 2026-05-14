# Spec Review — Task 8 (Phase 1 MVP): Linear mapping — bug detection

Verdict: ✅ Compliant

Checked inputs:
- Conventions: `thoughts/conventions.md`
- Plan addendum: `thoughts/tasks/phase1-mvp/plans/2026-05-12-phase1-mvp.addendum.md`
- Implementer report: `thoughts/tasks/phase1-mvp/impl/task-8/progress.md`

## Requirements Verification

### Required files modified (and only these in the Task 8 commit)
- `src/main/services/linear-mapping.ts` (adds `BUG_RX` + `isBug`) — see lines 10-19.
- `tests/main/linear-mapping.test.ts` (adds `isBug` tests) — see lines 17-29.

Commit `77f06b866813a5450ec55ad6aa5f2c75e9925b7e` message matches requirement exactly: `feat(main): bug detection via label or issueType`, and touches only the two required files.

### Tests added for `isBug`
`tests/main/linear-mapping.test.ts`:
- Labels `Bug`, `BUG`, `bug` => `true` (lines 18-22).
- `issueType.name === "Bug"` => `true` when labels are non-bug (e.g. `feature`) (line 24).
- `feature/null` and `empty/null` => `false` (lines 27-29).

### TDD “initial failing test” requirement
Implementer report records an initial pre-implementation failure: `TypeError: isBug is not a function` on `npx vitest run tests/main/linear-mapping.test.ts`. (See `thoughts/tasks/phase1-mvp/impl/task-8/progress.md`.)

### `BUG_RX` + `isBug(...)` implementation details
`src/main/services/linear-mapping.ts`:
- `BUG_RX = /^bug$/i` exists (line 10).
- `export function isBug(input: { labels: string[]; issueType: { name: string } | null }): boolean` exists (line 16).
- Checks labels first, then falls back to optional `issueType?.name` (lines 17-18).

### Explicit non-requirements / constraints
- Task 9 status mapping: not implemented (no status mapping changes present in `linear-mapping.ts`; commit scope matches Task 8).
- Addendum constraint (“don’t rewrite reference/protocol dirs via tooling”): satisfied by Task 8 commit scope (only the two code/test files changed; no `.agents/`, `thoughts/`, etc. rewritten).

## Local Verification (Reviewer)
- `npx vitest run tests/main/linear-mapping.test.ts` — pass (5 tests).
- `npm run test` — pass.
- `npm run typecheck` — pass.
- `npm run lint` — pass.
- `npm run format:check` — pass.

