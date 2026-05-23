# Task 12 QA Review - IPC triage handler comment-context pipeline

## Strengths

- The triage IPC handler mirrors the approved spec pipeline without copying unrelated spec-generation behavior. It fetches comments, optionally emits `triage:phase` triaging, contains triage failures, emits generating, and then calls `streamTriageBrief`.
- Zero-comment behavior is robust. `src/main/ipc/triage.ts:118` fetches by `issue.uuid`, returns `''` for an empty comment list, skips both `triageComments` and the triaging phase event, then still emits generating before the brief stream starts.
- Triage failure containment avoids error events as required. The inner catch in `curateTriageComments` logs a warning and returns `''`; the outer `TriageGenerateError` path is reserved for non-contained failures such as missing config, missing issue, comment-fetch failures, or stream failures.
- UUID versus identifier use is safe. The issue selection still uses the human identifier for the requested issue, while comment fetch uses the cached Linear UUID; the test asserts the dependency receives `triageIssue.uuid`.
- `register.ts` wiring stays narrow and does not introduce duplicate adapters. The same Linear client and comment triager service are composed into both spec and triage handlers through small dependency functions, while `streamTriageBrief` remains the only triage-brief generator.
- Test coverage is useful without being overly redundant. Task 12 adds the triage-specific coverage for phase events, zero-comment skipping, failure containment, and UUID fetch, while relying on existing triage tests for normal streaming, status mapping, done events, and configured-path errors.

## Issues

### Critical

None.

### Important

None.

### Minor

- There is no dedicated Task 12 assertion that `triage:phase` generating is before the first `triage:stream-chunk`. The implementation guarantees that order because `sendTriagePhase(... generating ...)` runs before `streamTriageBrief`, and existing tests observe the phase list, so this is not blocking. A future targeted assertion would make the ordering contract harder to regress accidentally.

## Drift detected

None. I did not find a repeated drift pattern from prior QA reviews. The final state avoids the earlier concerns around optional API weakening, circular mocked-output assertions, duplicate prompt construction, and identifier/UUID confusion.

## Assessment

Approved. Task 12 implements the triage comment-context pipeline with correct zero-comment behavior, local triage-failure containment, safe UUID-based comment fetch, and narrow registration wiring.

Verification run:
- `npm test -- tests/main/ipc-spec-generate.test.ts tests/main/ipc-spec-get.test.ts tests/main/ipc-triage.test.ts` - passed, 3 files / 34 tests.
- `npm run typecheck` - passed.
