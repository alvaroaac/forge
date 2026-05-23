# Task 3 QA Review - `comment-fetcher` service

## Strengths

- Scope is tight. The base-to-HEAD diff only creates `src/main/services/comment-fetcher.ts` and `tests/main/comment-fetcher.test.ts`; there is no triager logic, IPC orchestration, prompt wiring, or downstream coupling in this task.
- The normalization contract is implemented directly in `src/main/services/comment-fetcher.ts:21`: `id`, `body`, and `createdAt` pass through unchanged, `authorName` falls back to `Unknown`, and `isBot` is derived from `raw.botActor !== null`.
- Bot filtering uses only the requested existence check. `src/main/services/comment-fetcher.ts:36` filters on the normalized `isBot`, which is sourced solely from `botActor !== null`; it does not inspect author names, body text, bot IDs, or other heuristics.
- Ordering is preserved by the `map(...).filter(...)` pipeline in `src/main/services/comment-fetcher.ts:36`. Human survivors remain in the original client order, and bodies are not trimmed or rewritten.
- The exported `RawLinearComment` and `CommentsClient` types give later integration code a reusable raw shape instead of forcing another local duplicate in `register.ts` or IPC wiring.
- Test coverage is focused on the Task 3 risks: bot rows are dropped, the issue UUID argument is forwarded unchanged, empty responses stay empty, null human users become `Unknown`, and body/order preservation is asserted.
- The recreated spec-review artifact confirms the same Task 3 compliance points and reports no skipped work.
- No skipped Task 3 work appears unlogged. `thoughts/tech-debt.md` has no Task 3 comment-fetcher entry, and I did not find an unimplemented Task 3 requirement that needs one.

## Issues

### Critical

None.

### Important

None.

### Minor

None.

## Assessment

Approved. The implementation is narrow, type-friendly, and matches the Task 3 contract.

Verification run:
- `npm test -- tests/main/comment-fetcher.test.ts` - passed, 1 file / 4 tests.
- `npm run typecheck` - passed.
