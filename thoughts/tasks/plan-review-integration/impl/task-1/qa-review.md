# Task 1 QA Review

## Strengths

- The new review contract types are small, durable, and shared-safe. `SpecReviewSummary` and `SpecReviewResult` keep the renderer/main boundary clean by exposing plain serializable data only.
- The prompt builder and parser stay provider-neutral. I did not find Claude/Codex-specific assumptions, direct `plan-review` output coupling beyond raw feedback text, renderer changes, or Node APIs crossing into shared/renderer code.
- Parser coverage hits the required contract edges: valid response, missing tags, invalid JSON, empty revised spec, and fenced/preamble cleanup.
- The response tag constants reduce prompt/parser drift, and the Task 1 scope stayed focused on shared types plus main-process services.

## Issues

### Critical

- None.

### Important

- [src/main/services/spec-review-tags.ts:11](../../../../../src/main/services/spec-review-tags.ts#L11) The prompt template shows the model a summary block that is not valid JSON because `verdict` is rendered as `"approved" | "changes_requested"` on line 13. The parser then immediately requires `JSON.parse` on that block in [src/main/services/spec-review-response-parser.ts:43](../../../../../src/main/services/spec-review-response-parser.ts#L43). A model that follows the displayed contract literally will produce a parse failure in the demo flow. Prefer a valid JSON example plus prose saying `verdict` must be one of the two values, and add a prompt test that catches this by extracting/parsing the summary example.

### Minor

- [src/main/services/spec-review-response-parser.ts:40](../../../../../src/main/services/spec-review-response-parser.ts#L40) `parseSummaryJson` concentrates parsing plus all field validation in one function. Counting the `catch`, three `if` statements, and compound boolean checks, it appears to exceed the repo convention of cyclomatic complexity <= 4. Splitting field validators such as `parseVerdict`, `parseReviewerSummary`, and `parseCommentCount` would keep the parser easier to scan and within the stated convention.

## Drift detected

- None. There are no prior task `qa-review.md` files for this plan run, and this task did not establish a pattern that conflicts with prior QA guidance.

## Assessment

- Result: changes requested.
- Targeted verification passed: `npm test -- tests/shared/types.test.ts tests/main/spec-review-revision-prompt.test.ts tests/main/spec-review-response-parser.test.ts` reported 3 files / 14 tests passing.
- Typecheck passed: `npm run typecheck`.
- Additional check: `npm run lint` currently fails on pre-existing files outside this task diff (`src/main/ipc/spec.ts`, with two unrelated warnings), so I did not treat that as a Task 1 regression.
