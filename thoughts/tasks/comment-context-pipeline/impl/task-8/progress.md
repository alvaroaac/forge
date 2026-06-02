# Task 8 Progress

## Summary

- Added triage-generator tests proving `curatedComments` is forwarded to `streamClaude` when provided and remains omitted when absent.
- Added optional `curatedComments?: string` to `StreamTriageBriefInput` and the injected `streamClaude` input shape.
- Forwarded `input.curatedComments` from `streamTriageBrief` into `streamClaude`.

## Files Changed

- `src/main/services/triage-generator.ts`
- `tests/main/triage-generator.test.ts`
- `thoughts/tasks/comment-context-pipeline/impl/task-8/progress.md`

## Tests

- RED: `npm test -- tests/main/triage-generator.test.ts` failed as expected because `curatedComments` was `undefined`.
- GREEN: `npm test -- tests/main/triage-generator.test.ts` passed with 3 tests.

## Self-Review

- Scope kept to Task 8 behavior plus this progress artifact.
- No tech debt logged; no intentional skips.

## Commits

- This progress report is included in `feat(triage-generator): forward curatedComments to streamClaude`.
