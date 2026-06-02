# Task 3 Spec Review — comment-fetcher service

✅ Spec compliant

## Evidence

- Created the requested service at `src/main/services/comment-fetcher.ts`.
- Exports the required `LinearComment`, `RawLinearComment`, `CommentsClient`, `normalise`, and `fetchAndFilterComments` symbols: `src/main/services/comment-fetcher.ts:1`, `src/main/services/comment-fetcher.ts:9`, `src/main/services/comment-fetcher.ts:17`, `src/main/services/comment-fetcher.ts:21`, `src/main/services/comment-fetcher.ts:31`.
- `fetchAndFilterComments` calls `client.fetchIssueComments(issueId)` with the supplied issue id: `src/main/services/comment-fetcher.ts:35`.
- Normalisation preserves `id`, `body`, and `createdAt`, falls back to `authorName: 'Unknown'` for null users, and marks bots via `botActor !== null`: `src/main/services/comment-fetcher.ts:22`.
- Bot comments are filtered out after normalisation while human comment order is preserved by the `map(...).filter(...)` pipeline: `src/main/services/comment-fetcher.ts:36`.
- No triager logic was added; the service contains only comment typing, normalisation, fetching, and filtering.
- Created the requested focused test file at `tests/main/comment-fetcher.test.ts`.
- Tests cover bot filtering and client call: `tests/main/comment-fetcher.test.ts:15`.
- Tests cover empty comment responses: `tests/main/comment-fetcher.test.ts:46`.
- Tests cover `Unknown` author fallback for surviving null-user comments: `tests/main/comment-fetcher.test.ts:51`.
- Tests cover verbatim body preservation and order preservation: `tests/main/comment-fetcher.test.ts:73`.
- Verified commit `97b5768049f46fa746e05e86e36e640d6c8eb966` has message `feat(comment-fetcher): normalise + bot-filter Linear comments` and contains only `src/main/services/comment-fetcher.ts` and `tests/main/comment-fetcher.test.ts`.

## Verification

- `npm test -- tests/main/comment-fetcher.test.ts` — passed, 4 tests.
