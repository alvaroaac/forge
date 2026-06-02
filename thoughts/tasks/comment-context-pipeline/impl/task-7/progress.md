# Task 7 Progress — Wire `curatedComments` into `spec-generator`

## Status

DONE

## What Changed

- Added `curatedComments?: string` to `StreamSpecInput`.
- Added payload-building behavior so non-empty curated comments are prepended above the issue body as:
  `## Comment context\n\n{curated}\n\n---\n\n{user}`.
- Left absent and empty `curatedComments` inputs passing the original user body unchanged.
- Added spec-generator tests for non-empty, undefined, and empty-string curated comment payloads.

## Files Changed

- `src/main/services/spec-generator.ts`
- `tests/main/spec-generator.test.ts`

## Tests Run

- `npm test -- tests/main/spec-generator.test.ts`
  - RED before implementation: failed on missing comment-context prepend.
  - GREEN after implementation: 10 tests passed.
- `npm run typecheck`
  - Passed.

## Self-Review

- Scope stayed limited to Task 7 implementation files plus this progress artifact.
- Existing user/body behavior is preserved when `curatedComments` is absent or empty.
- No tech debt logged; no intentionally skipped items.

## Commit

- `feat(spec-generator): inject curatedComments above issue body`
