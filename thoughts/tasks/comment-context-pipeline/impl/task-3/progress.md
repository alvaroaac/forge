# Task 3 Progress — comment-fetcher service

## Status

DONE

## Files changed

- `src/main/services/comment-fetcher.ts`
  - Added exported `LinearComment`, `RawLinearComment`, and `CommentsClient` interfaces.
  - Added exported `normalise(raw)` helper.
  - Added `fetchAndFilterComments(client, issueId)` to call `fetchIssueComments`, normalise rows, and drop bot comments.
- `tests/main/comment-fetcher.test.ts`
  - Added the Task 3 focused coverage for bot row filtering, normalisation, empty responses, `Unknown` author fallback, verbatim body preservation, and order preservation.

## Tests run/results

- RED: `npm test -- tests/main/comment-fetcher.test.ts`
  - Failed as expected before implementation: `Failed to load url ../../src/main/services/comment-fetcher`.
- GREEN: `npm test -- tests/main/comment-fetcher.test.ts`
  - Passed: 1 file, 4 tests.

## Commit

- `97b5768049f46fa746e05e86e36e640d6c8eb966` — `feat(comment-fetcher): normalise + bot-filter Linear comments`

## Self-review findings

- Scope stayed limited to Task 3's comment-fetcher service and focused test.
- `fetchAndFilterComments` calls the client with the provided issue UUID/id argument unchanged.
- Bot detection uses `botActor !== null`; bot rows are removed after normalisation.
- Human comment bodies and ordering are preserved by the map/filter pipeline.
- Missing Linear users on surviving rows produce `authorName: 'Unknown'`.
- No triager logic or downstream prompt wiring was added.

## Tech-debt logged

None.

## Concerns

None.
