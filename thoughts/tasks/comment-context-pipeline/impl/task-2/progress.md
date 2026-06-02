# Task 2 Progress — Preserve Linear UUID on cached Issue

## Status

DONE

## Files changed

- `src/shared/types.ts`
  - Added required `uuid: string` to `Issue`.
- `src/main/services/linear-service.ts`
  - Populated `Issue.uuid` from Linear `raw.id` while keeping `Issue.id` mapped to `raw.identifier`.
- `tests/main/linear-service.test.ts`
  - Added the UUID preservation regression test.
  - Updated exact mapped-issue expectations to include `uuid`.
- Test fixtures constructing `Issue` literals
  - Added `uuid: 'uuid-test-fixture'` consistently across main and renderer tests flagged by typecheck.

## Tests run/results

- RED: `npm test -- tests/main/linear-service.test.ts`
  - Failed as expected before implementation: `mapped.uuid` was `undefined` instead of `11111111-2222-3333-4444-555555555555`.
- GREEN focused: `npm test -- tests/main/linear-service.test.ts`
  - Passed: 1 file, 6 tests.
- Typecheck: `npm run typecheck`
  - Passed after adding `uuid` to all typed `Issue` fixtures.
- Full suite: `npm test`
  - Passed: 58 files, 311 tests.

## Commit

- `788258e4066bc380dd7d9a038db8defbbbbe5493` — `feat(issue): preserve Linear UUID alongside identifier`

## Self-review findings

- Scope stayed limited to Task 2: shared `Issue` shape, `mapIssue`, the focused mapper test, and fixture updates required by the new type.
- `Issue.id` still contains the Linear identifier such as `FUL-77`.
- `Issue.uuid` now contains the Linear UUID from `raw.id`, allowing later comment-fetch paths to call `fetchIssueComments(issue.uuid)` without another detail fetch.
- No bridge helper, fallback lookup, or extra fetch path was introduced.

## Tech-debt logged

None.

## Concerns

None.
