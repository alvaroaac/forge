# Task 12 Progress - IPC triage handler comment-context pipeline

## Summary

- Added triage IPC tests for comment fetch, comment triage, phase-event ordering, triage failure tolerance, empty-comment skipping, and UUID-based comment fetch.
- Extended `TriageGenerateDeps` with required `fetchAndFilterComments` and `triageComments` dependencies.
- Added `curatedComments?: string` to the triage brief streaming input and passed curated comment context into generation.
- Updated the triage generate handler to fetch comments with `issue.uuid`, emit `triage:phase` triaging only for non-empty comment sets, tolerate triage failures with `console.warn`, and always emit generating before streaming.
- Updated IPC registration only as required by typecheck to bind the existing comment fetcher and triager into the triage generate handler.

## Files Changed

- `src/main/ipc/triage.ts`
- `tests/main/ipc-triage.test.ts`
- `src/main/ipc/register.ts`
- `thoughts/tasks/comment-context-pipeline/impl/task-12/progress.md`

## Tests Run

- RED: `npm test -- tests/main/ipc-triage.test.ts` failed with the new Task 12 tests because the handler did not yet fetch comments, emit phase events, or pass `curatedComments`.
- GREEN: `npm test -- tests/main/ipc-triage.test.ts` passed.
- `npm run typecheck` initially failed because `register.ts` had not yet provided the new required triage dependencies.
- `npm run typecheck` passed after the narrow wiring update.

## Self-Review

- Triage failures are contained inside the comment-curation helper and do not flow into the outer `TriageGenerateError` path.
- Empty comment sets skip both the triaging phase event and the triage dependency call, while still emitting generating before `streamTriageBrief`.
- Fetch uses the issue UUID rather than the display identifier.

## Tech Debt

- None logged.

## Commit

- `feat(triage-ipc): orchestrate fetch->triage->generate with phase events`
