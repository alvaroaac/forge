# Task 2 QA Review - Preserve Linear UUID on cached `Issue`

## Strengths

- The production change is exactly scoped to the Task 2 contract. `Issue.uuid` is required in `src/shared/types.ts:6`, and `mapIssue` preserves the Linear UUID with `uuid: raw.id` while leaving `id: raw.identifier` unchanged in `src/main/services/linear-service.ts:38`.
- The regression test directly protects the important semantic split: `Issue.id` remains the human Linear identifier and `Issue.uuid` carries the raw Linear UUID in `tests/main/linear-service.test.ts:61`.
- Existing mapper/detail expectations were updated to include UUIDs, so future regressions in `mapIssue` or `fetchIssueDetail` will fail with clear diffs.
- Fixture hygiene is good. The broad test fixture updates are mechanical, consistently use `uuid: 'uuid-test-fixture'` where the value is irrelevant, and avoid unrelated assertion churn.
- I found no bridge helper, no identifier-to-UUID fallback lookup, and no extra comment/detail fetch path introduced by Task 2.
- No skipped Task 2 work appears unlogged. The progress report lists no tech debt, and I did not find an unimplemented Task 2 requirement that needs a `thoughts/tech-debt.md` entry.

## Issues

### Critical

None.

### Important

None.

### Minor

- `src/main/services/issues-cache.ts:13` still reads persisted JSON with a blind `as Issue[]` cast. That means an older on-disk cache written before this commit can briefly surface issues without `uuid` until refresh replaces it. This does not violate the Task 2 mapper/type requirement, and the app already refreshes after reading cache, but later comment-context tasks should avoid assuming cached startup rows are always UUID-complete unless the cache is invalidated, validated, or refreshed before generation.

## Assessment

Approved. Task 2 preserves both identifier and UUID cleanly, keeps the implementation narrow, updates fixtures mechanically, and adds focused regression coverage.

Verification run:
- `npm test -- tests/main/linear-service.test.ts` - passed, 1 file / 6 tests.
- `npm run typecheck` - passed.
- `npm test` - passed, 58 files / 311 tests.
