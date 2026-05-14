✅ Spec compliant

- Missing requirements: none. `SpecReviewSummary` and `SpecReviewResult` were added with the required fields in [src/shared/types.ts](/Users/alvarocarvalho/desenv/personal/forge/src/shared/types.ts:57). The prompt builder includes the original spec, raw review feedback, and the two tagged response sections in [src/main/services/spec-review-revision-prompt.ts](/Users/alvarocarvalho/desenv/personal/forge/src/main/services/spec-review-revision-prompt.ts:8). The parser rejects missing tags, invalid JSON, and empty revised specs, and it cleans fenced/preamble markdown in [src/main/services/spec-review-response-parser.ts](/Users/alvarocarvalho/desenv/personal/forge/src/main/services/spec-review-response-parser.ts:7). Focused TDD coverage exists in [tests/shared/types.test.ts](/Users/alvarocarvalho/desenv/personal/forge/tests/shared/types.test.ts:45), [tests/main/spec-review-revision-prompt.test.ts](/Users/alvarocarvalho/desenv/personal/forge/tests/main/spec-review-revision-prompt.test.ts:4), and [tests/main/spec-review-response-parser.test.ts](/Users/alvarocarvalho/desenv/personal/forge/tests/main/spec-review-response-parser.test.ts:4), and those tests pass.
- Extras: none found. The task stayed within shared types plus main-process prompt/parser code. The reviewed commit only touched the intended files, and there are no renderer or launch-review changes in this task.
- Misunderstandings: none found. The contract remains provider-neutral; the types and parser do not depend on `plan-review` internals beyond consuming raw feedback text.
- Addendum-rule check: pass. No addendum exists for this plan task.
- Tech-debt-accounting check: pass. I did not find any intentional skips in the implementation that should have been logged to [thoughts/tech-debt.md](/Users/alvarocarvalho/desenv/personal/forge/thoughts/tech-debt.md:1), and `progress.md`’s `none` entry is consistent with the code reviewed.

Verification:
- `npm test -- tests/shared/types.test.ts tests/main/spec-review-revision-prompt.test.ts tests/main/spec-review-response-parser.test.ts`
- `npm run typecheck`
