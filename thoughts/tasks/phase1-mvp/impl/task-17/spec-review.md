# Task 17 Spec Review — Linear service (viewer id + raw fetch)

Verdict: ✅

Checked artifacts
- Conventions: `thoughts/conventions.md`
- Plan addendum: `thoughts/tasks/phase1-mvp/plans/2026-05-12-phase1-mvp.addendum.md`
- Progress report: `thoughts/tasks/phase1-mvp/impl/task-17/progress.md`

Spec compliance notes
- Required files exist:
  - `src/main/services/linear-service.ts`
  - `tests/main/linear-service.test.ts`
- Implementation matches Task 17 plan:
  - Defines `LinearClientShape` and exports `RawLinearIssue` with the plan’s fields/types. (`src/main/services/linear-service.ts:1-16`)
  - `fetchRaw(client)` calls `getCurrentUser()` then `fetchAssignedIssues(me.id)` and returns the raw array. (`src/main/services/linear-service.ts:18-21`)
  - No Task 18 mapping (`mapIssue`) is implemented yet (file contains only `RawLinearIssue` + `fetchRaw`).
- Test matches requirement and avoids unreasoned `any`:
  - Uses a typed `LinearClientShape` in-test and a `satisfies RawLinearIssue` fixture; no `any` used. (`tests/main/linear-service.test.ts:4-33`)
  - Asserts `getCurrentUser` called, `fetchAssignedIssues` called with `'u1'`, and returned value equals the raw array. (`tests/main/linear-service.test.ts:29-33`)
- TDD red evidence: progress report includes concrete “pre-fix” failure evidence (module-resolution failure due to missing `linear-service.ts`) prior to commit `adce6d1`. (See `progress.md` excerpted error.)
- Complexity: 1 (single straight-line async flow; no branching). (`src/main/services/linear-service.ts:18-21`)

Verification
- Commits present:
  - `adce6d1 feat(main): linear-service.fetchRaw via viewer id` (adds service + test)
  - `1e54c4b chore(task-17): record red-phase audit evidence` (updates progress report)
- Re-ran checks in current workspace:
  - `npx vitest run tests/main/linear-service.test.ts` PASS
  - `npm run test` PASS
  - `npm run typecheck` PASS
  - `npm run lint` PASS (1 pre-existing warning in `tests/main/paths.test.ts` about unused `vi`)
  - `npm run format:check` PASS

