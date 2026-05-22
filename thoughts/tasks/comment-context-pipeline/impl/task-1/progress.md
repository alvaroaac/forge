# Task 1 Progress — Linear client fetchIssueComments

## Status

DONE

## Files changed

- `.agents/skills/linear/reference/linear.mjs`
  - Added cursor pagination to `fetchIssueComments(issueId)` so it accumulates all comment pages.
  - Preserved the first-page `comments(first: 250)` query shape and uses `after` only for subsequent pages.
- `tests/main/linear-skill-fetchIssueComments.test.ts`
  - Added pagination regression coverage for a two-page comment thread.
  - Preserved checks for `comments(first: 250)` and `botActor { id }`.
- `.agents/skills/linear/SKILL.md`
  - Previously documented the Task 1 read contract as every comment on the issue. No follow-up doc change was needed.

## Tests run/results

- RED: `npm test -- tests/main/linear-skill-fetchIssueComments.test.ts`
  - Failed as expected before implementation: pagination returned only `['c-1']` instead of `['c-1', 'c-2']`.
- GREEN: `npm test -- tests/main/linear-skill-fetchIssueComments.test.ts`
  - Passed: 1 file, 4 tests.

## Commits

- Initial Task 1 commit: `5a7761675951052bddcce32b45b3e50a04d168aa`
- QA follow-up commit: `652d88e9d67d66c164fe90be347d1f1c0d032320`

## Self-review findings

- Scope stayed limited to Task 1 client/test/report files for the QA fix.
- `fetchIssueComments` now follows `pageInfo.hasNextPage` and advances with `pageInfo.endCursor`.
- Missing issue or missing comments still returns `[]`.
- The query still selects only `botActor { id }`.

## Tech-debt logged

None.

## Concerns

None.
