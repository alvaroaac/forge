# Task 11 Progress — IPC spec handler comment-context pipeline

## Summary

- Extended `spec:generate` tests with the comment fetch, triage, phase-event, failure-tolerance, ordering, and UUID-fetch cases from Task 11.
- Added required `fetchAndFilterComments` and `triageComments` dependencies to `SpecGenerateDeps`.
- Added `curatedComments?: string` to the IPC handler's `streamSpec` input type and passed the curated output into generation.
- Wired the handler to fetch comments with `issue.uuid`, emit `spec:phase` triaging only for non-empty comment sets, tolerate triage failures with `console.warn`, and always emit generating before streaming.
- Updated production IPC registration to provide the new required dependencies through the existing Linear client and comment triager.

## Files Changed

- `src/main/ipc/spec.ts`
- `src/main/ipc/register.ts`
- `tests/main/ipc-spec-generate.test.ts`
- `thoughts/tasks/comment-context-pipeline/impl/task-11/progress.md`

## Tests Run

- RED: `npm test -- tests/main/ipc-spec-generate.test.ts` failed with the new Task 11 tests because the handler did not yet fetch comments, emit phase events, or pass `curatedComments`.
- GREEN: `npm test -- tests/main/ipc-spec-generate.test.ts` passed.
- `npm test -- tests/main/ipc-spec-generate.test.ts tests/main/ipc-spec-get.test.ts` passed.
- `npm run typecheck` passed.

## Self-Review

- Triage failures are contained inside the comment-curation helper and do not flow into the outer `SpecGenerateError` path.
- Empty comment sets skip both the triaging phase event and the triage dependency call, while still emitting generating before `streamSpec`.
- Fetch uses the issue UUID rather than the display identifier.

## Tech Debt

- None logged.

## Commit

- `feat(spec-ipc): orchestrate fetch→triage→generate with phase events`
