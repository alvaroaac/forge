# Task 1 Progress — Durable Review Contract and Revision Parser

- Status: DONE
- Implementer model: `gpt-5.3-codex`
- Planned reviewers: `gpt-5.4`, `gpt-5.5`

## What I implemented

1. Added durable shared review types in `src/shared/types.ts`:
   - `SpecReviewSummary`
   - `SpecReviewResult`
2. Added provider-neutral revision prompt builder in `src/main/services/spec-review-revision-prompt.ts`:
   - accepts original spec markdown and raw review feedback
   - instructs model to return only the two tagged sections
3. Added tagged response parser in `src/main/services/spec-review-response-parser.ts`:
   - rejects missing summary tag
   - rejects missing revised-spec tag
   - rejects invalid summary JSON
   - rejects empty revised spec
   - cleans fenced/preamble revised markdown
4. Added shared tag/template constants in `src/main/services/spec-review-tags.ts` to keep prompt and parser in sync.

## Tests run and results

- `npm test -- tests/shared/types.test.ts tests/main/spec-review-revision-prompt.test.ts tests/main/spec-review-response-parser.test.ts`
  - Result: PASS (3 files, 14 tests)
- `npm run typecheck`
  - Result: PASS

## Files changed

- `src/shared/types.ts`
- `src/main/services/spec-review-tags.ts`
- `src/main/services/spec-review-revision-prompt.ts`
- `src/main/services/spec-review-response-parser.ts`
- `tests/shared/types.test.ts`
- `tests/main/spec-review-revision-prompt.test.ts`
- `tests/main/spec-review-response-parser.test.ts`

## Commit hash(es)

- `6987a8b`

## Self-review findings

- Response contract is centralized via shared tag constants to reduce drift risk.
- Parser validates required summary fields and strips common markdown wrappers/preamble.
- Scope kept to Task 1 ownership (shared types + main-process services + focused tests), with no renderer changes.

## Tech-debt logged

- none

## Concerns

- none
