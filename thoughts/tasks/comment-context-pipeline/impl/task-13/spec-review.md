# Task 13 Spec Review

Verdict: ✅ Spec compliant

## Findings

- Production `register.ts` imports and wires the shared comment pipeline without duplicating the raw Linear comment shape. `fetchAndFilterComments`, `CommentsClient`, `RawLinearComment`, and `triageComments` are imported from the service modules in `src/main/ipc/register.ts:16-18`; `LinearClient.fetchIssueComments` returns `Promise<RawLinearComment[]>` in `src/main/ipc/register.ts:38-45`, reusing the exported shape from `src/main/services/comment-fetcher.ts:9-18`.
- `LinearClient` includes `fetchIssueComments`, and the actual Linear skill exports the operation. The IPC client interface includes it in `src/main/ipc/register.ts:38-45`; the Linear skill implements it in `.agents/skills/linear/reference/linear.mjs:604-638` and returns it from `createLinearClient` in `.agents/skills/linear/reference/linear.mjs:640-662`.
- Both generation handlers receive bound comment fetcher and triager dependencies. Spec wiring passes `fetchAndFilterComments: (issueUuid) => fetchAndFilterComments(client as CommentsClient, issueUuid)` and `triageComments` with `streamClaude` in `src/main/ipc/register.ts:95-106`; triage wiring does the same in `src/main/ipc/register.ts:129-145`. The explicit destructuring is equivalent to `triageComments({ ...input, streamClaude })` for the current triager input shape.
- The new wiring test covers the bound production path for both spec and triage registrations. It captures `SpecGenerateDeps` and `TriageGenerateDeps` from `registerAll` in `tests/main/register.test.ts:137-138`, calls both registered `fetchAndFilterComments` bindings in `tests/main/register.test.ts:140-149`, and verifies the underlying client was called with each UUID in `tests/main/register.test.ts:151-152`. It also verifies both registered `triageComments` bindings are callable in `tests/main/register.test.ts:153-166`.
- Commit `5ed915f` contains the Task 13 changes: `tests/main/register.test.ts` and `thoughts/tasks/comment-context-pipeline/impl/task-13/progress.md`.

## Verification

- `npm test -- tests/main/register.test.ts` passed: 1 test file, 1 test.
- `npm run typecheck` passed.
- `npm test` passed: 61 test files, 347 tests.
