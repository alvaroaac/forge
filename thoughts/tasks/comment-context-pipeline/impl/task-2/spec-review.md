# Task 2 Spec Review — Preserve Linear UUID on cached Issue

✅ Spec compliant

## Evidence

- `Issue` now requires `uuid: string` alongside the existing identifier-backed `id`: `src/shared/types.ts:4-16`.
- `mapIssue` keeps `Issue.id = raw.identifier` and preserves the Linear UUID with `Issue.uuid = raw.id`: `src/main/services/linear-service.ts:35-50`.
- UUID preservation regression coverage exists and asserts both sides of the contract: `tests/main/linear-service.test.ts:61-78`.
- Existing mapper/detail expectations were updated to include the new UUID field: `tests/main/linear-service.test.ts:27-39`, `tests/main/linear-service.test.ts:129-141`.
- Typed `Issue` fixtures flagged by the shape change were updated with `uuid: 'uuid-test-fixture'` across main and renderer tests; sampled direct references include `tests/main/ipc-spec-generate.test.ts:66-76`, `tests/main/ipc-triage.test.ts:41-52`, `tests/main/spec-prompt.test.ts:5-16`, `tests/main/triage-generator.test.ts:5-16`, `tests/renderer/app.test.tsx:136-172`, and `tests/renderer/issue-list-panel.test.tsx:51-130`.
- The Task 2 commit is present as requested: `788258e4066bc380dd7d9a038db8defbbbbe5493` — `feat(issue): preserve Linear UUID alongside identifier`.
- Commit scope is limited to the shared type, `mapIssue`, the focused mapper test, and fixture updates. I found no new identifier-to-UUID bridge helper or extra fetch path in the Task 2 diff.
- Tech-debt accounting is acceptable: no skipped Task 2 requirements were found, and the progress report logs no tech debt.

## Verification Run

- `npm test -- tests/main/linear-service.test.ts` — passed, 1 file / 6 tests.
- `npm run typecheck` — passed for main, renderer, and test TypeScript projects.
- `npm test` — passed, 58 files / 311 tests.
