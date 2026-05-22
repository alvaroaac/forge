# Task 13 Progress - register.ts comment-context wiring coverage

## Summary

- Confirmed Task 11 and Task 12 already added the production `register.ts` wiring for `fetchAndFilterComments`, `RawLinearComment`, `LinearClient.fetchIssueComments`, and `triageComments`.
- Added a focused `registerAll` wiring test that captures the registered spec and triage handler deps.
- Verified both registered `fetchAndFilterComments` deps delegate through `fetchAndFilterComments(client, uuid)` to the bound Linear client's `fetchIssueComments` with the issue UUID.
- Verified both registered handler deps expose callable `triageComments` bindings.

## Files Changed

- `tests/main/register.test.ts`
- `thoughts/tasks/comment-context-pipeline/impl/task-13/progress.md`

## Tests Run

- `npm test -- tests/main/register.test.ts` passed. The new test passed immediately because the production wiring had already been added by Tasks 11 and 12.
- `npm run typecheck` passed.
- `npm test` passed: 61 test files, 347 tests.

## Self-Review

- Did not duplicate or rewrite existing production wiring in `src/main/ipc/register.ts`.
- The new test exercises `registerAll` rather than only the comment-fetcher service, so it covers the actual dependency lambdas passed to spec and triage handler registration.
- Existing unrelated untracked task/review artifacts were left untouched.

## Tech Debt

- None logged.

## Commit

- `feat(ipc-register): bind comment fetcher + triager into spec/triage handlers`
