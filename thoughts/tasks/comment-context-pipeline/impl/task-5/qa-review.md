# Task 5 QA Review - `comment-triager` per-rule prompt coverage

## Strengths

- Scope is tight. The base-to-head diff only appends the planned per-rule prompt coverage block in `tests/main/comment-triager.test.ts` and makes the minimum prompt text realignment in `src/main/services/comment-triager.ts`.
- The new rule checks use literal `toContain` assertions for prompt text, including the Rule 3 `"won't do this"` phrase and the Rule 6 escaped `## Relevant Comments\\n_(none)_` output shape. This directly avoids the brittle whitespace/escape regex failure mode called out in the v2 plan.
- Rule 5 coverage checks the allowed reason values as literal backticked tokens and adds literal negative checks for `` `spam` `` and `` `duplicate` ``. That is enough for Task 5 prompt-surface coverage without drifting into the later Task 6 output-contract detector.
- The tests do not duplicate the v1 circular mocked-output anti-pattern. The new block only inspects `COMMENT_TRIAGER_SYSTEM_PROMPT`; it does not mock Claude into returning the exact expected output shape and then assert the mock.
- The production prompt edit is minimal and safe: `src/main/services/comment-triager.ts:38` joins `"won't do this"` onto one line so the approved literal appears contiguously, while preserving the existing rejected/decided-against rule semantics.
- Existing invocation-contract tests remain intact, so the Task 4 guarantees around model pinning, system prompt wiring, user prompt rendering, rejection propagation, and untouched output return are still covered alongside the new prompt checks.
- No skipped Task 5 work appears unlogged. The progress report lists no tech debt, and I did not find an unimplemented Task 5 requirement that needs a `thoughts/tech-debt.md` entry.

## Issues

### Critical

None.

### Important

None.

### Minor

None.

## Assessment

Approved. Task 5 adds the intended literal prompt coverage, keeps prompt realignment to the smallest necessary production change, avoids circular mocked-output assertions, and leaves output-shape behavior to the planned Task 6 smoke tests.

Verification run:
- `npm test -- tests/main/comment-triager.test.ts` - passed, 1 file / 13 tests.
