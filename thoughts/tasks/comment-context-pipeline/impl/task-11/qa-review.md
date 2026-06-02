# Task 11 QA Review - IPC spec handler comment-context pipeline

## Strengths

- The phase pipeline is ordered correctly in production. `curateSpecComments` emits `spec:phase` triaging only after a non-empty comment fetch, `registerSpecGenerateHandler` emits `spec:phase` generating before `streamSpec`, and stream chunks are still sent only through the existing `onChunk` callback path.
- Zero-comment behavior is intentionally quiet. `src/main/ipc/spec.ts:125` fetches by `issue.uuid`, returns `''` immediately for an empty comment list, skips `triageComments`, skips the triaging phase event, then still emits generating before generation.
- Triage failure containment is local to the comment-curation step. The `triageComments` call is the only code inside the inner `try/catch`; on failure it logs `console.warn`, returns `''`, continues to `streamSpec`, and does not fall through to the outer `SpecGenerateError` path.
- UUID versus identifier use is safe for this handler. The issue is still looked up by the display identifier from the payload, but comment fetch uses `issue.uuid`; the regression test asserts `fetchAndFilterComments` receives `issue.uuid`, not `issue.id`.
- The handler keeps generation concerns separated. `streamSpec` receives `curatedComments: curated` without duplicating prompt-prepend logic from Task 7.
- The `register.ts` wiring is appropriately located at the composition boundary. It reuses the existing Linear client, wraps it once with `fetchAndFilterComments`, and reuses the existing `triageComments` service with `streamClaude`; no duplicate adapter module or second comment-fetch path was introduced.
- The tests cover the important user-visible and failure-mode behavior: non-empty phase count, zero-comment skipping, triage failure with no error event, phase-before-chunk ordering, and UUID fetch.

## Issues

### Critical

None.

### Important

None.

### Minor

- The explicit ordering regression only asserts that the first phase event occurs before the first `spec:stream-chunk`. The implementation does emit both `triaging` and `generating` before chunks, and other assertions cover phase order, so this is not a blocker; a future cleanup could assert the full channel order for the non-empty case to make the test read exactly like the contract.

## Drift detected

None. I did not find a repeated drift pattern from prior QA reviews. The implementation avoids the earlier themes of brittle mocked-output tests, weakened shared contracts, duplicate prompt logic, and identifier/UUID ambiguity.

## Assessment

Approved. Task 11 cleanly inserts the spec comment-context pipeline, preserves zero-comment behavior, contains triage failures without error events, uses the Linear UUID for comment fetch, and keeps production wiring narrow.

Verification run:
- `npm test -- tests/main/ipc-spec-generate.test.ts tests/main/ipc-spec-get.test.ts tests/main/ipc-triage.test.ts` - passed, 3 files / 34 tests.
- `npm run typecheck` - passed.
