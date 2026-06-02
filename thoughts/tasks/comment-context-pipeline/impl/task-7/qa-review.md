# Task 7 QA Review - Wire `curatedComments` into `spec-generator`

## Strengths

- Scope is tight. Commit `c31ac4c` only changes `src/main/services/spec-generator.ts`, `tests/main/spec-generator.test.ts`, and the Task 7 progress artifact.
- The public input shape is clear: `StreamSpecInput` adds optional `curatedComments?: string` at `src/main/services/spec-generator.ts:14`, and `StreamClaudeInput` continues to alias that same shape rather than introducing a second prompt contract.
- The payload helper is small and readable. `buildUserPayload` at `src/main/services/spec-generator.ts:130` handles the entire comment-context decision in one place and keeps the existing `streamClaude` flow unchanged except for the stdin payload.
- The prepend behavior matches the plan exactly for non-empty values: `## Comment context\n\n{curatedComments}\n\n---\n\n{user}`.
- Absent and empty-string behavior is preserved. The falsy guard returns the original user body unchanged when `curatedComments` is undefined or `''`.
- Tests exercise the actual stdin payload written to the fake child process, not a mocked helper return. The new coverage captures non-empty prepend, undefined unchanged, and empty-string unchanged in `tests/main/spec-generator.test.ts:298`.
- The change does not alter CLI args, status handling, stdout parsing, timeout behavior, or error handling.

## Issues

### Critical

None.

### Important

None.

### Minor

None.

## Drift detected

None. I did not find a repeated drift pattern from prior QA reviews. The missing `thoughts/tasks/comment-context-pipeline/impl/task-6/qa-review.md` means Task 6 had no prior QA artifact to compare directly, but its progress/spec-review files do not surface a conflicting pattern for Task 7.

## Assessment

Approved. The helper is clear, the exact prepend contract is implemented, absent/empty values preserve old behavior, and the tests validate the real stdin payload.

Verification run:
- `npm test -- tests/main/spec-generator.test.ts` - passed, 1 file / 10 tests.
- `npm run typecheck` - passed.
