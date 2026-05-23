# Task 5 Progress - comment-triager per-rule prompt coverage

## Status

Complete.

## Files Changed

- `tests/main/comment-triager.test.ts`
  - Appended the `COMMENT_TRIAGER_SYSTEM_PROMPT - per-rule coverage` describe block from the approved Task 5 plan.
  - Added seven `toContain`/`not.toContain` cases covering Rules 1-7, including Rule 5 allowed reason vocabulary and Rule 6 escaped `## Relevant Comments\\n_(none)_`.
- `src/main/services/comment-triager.ts`
  - Realigned Rule 3 prompt text after the new coverage exposed the approved literal `"won't do this"` was split across a line break.

## Tests Run

- `npm test -- tests/main/comment-triager.test.ts`
  - First run: failed 1 of 13 tests.
  - Failure: Rule 3 expected `COMMENT_TRIAGER_SYSTEM_PROMPT` to contain `"won't do this"`, but the prompt split the phrase across a newline.
- `npm test -- tests/main/comment-triager.test.ts`
  - Final run: passed, 1 file / 13 tests.

## Commit

- `4448793e47fdaa0314a8252762b7d8ee6a0a60e9` - `test(comment-triager): per-rule prompt coverage`

## Self-Review Findings

- Scope stayed within Task 5: prompt coverage tests plus the minimum prompt realignment required by the failing coverage test.
- The Task 5 block uses literal `toContain` checks as specified.
- Rule 5 includes the required positive vocabulary checks and negative checks for `` `spam` `` and `` `duplicate` ``.
- Rule 6 checks the escaped literal `## Relevant Comments\\n_(none)_`.
- Existing unrelated untracked planning/review files were not modified or staged.

## Tech Debt Logged

None.

## Concerns

None.
