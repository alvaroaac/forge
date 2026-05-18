✅ Spec compliant

The requested Task 2 change is implemented exactly as scoped:

- `src/main/services/linear-mapping.ts:10-17` maps `triage` to `'triage'` while preserving the existing `backlog`/`unstarted` → `todo`, `started` → `in_progress`, `review` → `in_review`, and `completed`/`canceled` → `done` behavior.
- `tests/main/linear-mapping.test.ts:33-40` now asserts `expect(mapStatus({ name: 'Triage', type: 'triage' })).toBe('triage')`.
- The targeted test passes in the current state: `npm test -- tests/main/linear-mapping.test.ts` returned 7/7 passing.
- The commit message matches the requested form: `feat(linear): map Linear triage state.type to IssueStatus 'triage'` (`a9363e3`).

Missing requirements: none.

Extra/unneeded work: none in the implementation scope. The only additional artifact change is the expected `thoughts/tasks/add-triage/impl/task-2/progress.md` report.

Misunderstandings: none observed.

Tech-debt accounting: none logged, which is appropriate for this narrow mapping-only change.

