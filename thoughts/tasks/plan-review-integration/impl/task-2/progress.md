# Task 2 Progress — Thin External `plan-review` Bridge and IPC

- Status: DONE
- Implementer model: `gpt-5.3-codex`
- Planned reviewers: `gpt-5.4`, `gpt-5.5`

## What I implemented

1. Added `plan-review` as an app dependency in `package.json` (and updated `package-lock.json`).
2. Added a reusable safe issue-id utility in `src/main/lib/issue-id.ts` and reused it in spec IPC + bridge validation.
3. Added a thin external bridge service in `src/main/services/spec-review-bridge.ts`:
   - validates issue id before side effects
   - creates unique temp dir under OS temp (outside `thoughts/`)
   - writes cleaned input as `review-input.md`
   - spawns exact demo command:
     - `plan-review <input> --fresh --split-by heading -o file --output-file <output>`
   - waits for exit
   - reads `plan-review-output.md`
   - calls Forge-owned selected-model revision path
   - returns `SpecReviewResult`
   - best-effort cleanup in `finally`
   - does not persist revised spec
4. Added provider-neutral revision orchestration in `src/main/services/spec-review-revision.ts`:
   - builds Task 1 revision prompt
   - executes injected model function
   - parses Task 1 tagged response into `SpecReviewResult`
5. Added new IPC channel and API surface:
   - `src/shared/ipc-channels.ts`: `spec:launch-review`
   - `src/shared/forge-api.ts`: `spec.launchReview(issueId, content, model)`
   - `src/main/preload.ts`: preload invoke wiring
   - `src/main/ipc/spec.ts`: `registerSpecLaunchReviewHandler`
   - `src/main/ipc/register.ts`: wires bridge + selected-model revision using existing Claude CLI stream path (`streamSpec`) as the model executor
6. Kept launchReview non-persistent by design; no call path writes revised content to file.

## Tests run and results

- `npm test -- tests/shared/ipc-channels.test.ts tests/main/preload.test.ts tests/main/spec-review-bridge.test.ts tests/main/ipc-spec-review.test.ts`
  - Result: PASS (4 files, 9 tests)
- `npm run typecheck`
  - Result: PASS
- `npm test -- tests/shared/ipc-channels.test.ts tests/main/preload.test.ts tests/main/spec-review-bridge.test.ts tests/main/ipc-spec-review.test.ts tests/renderer/app.test.tsx tests/renderer/use-auth-status.test.ts tests/renderer/use-issues.test.ts tests/renderer/use-spec-stream.test.ts`
  - Result: PASS (8 files, 33 tests)

## Files changed

- `package.json`
- `package-lock.json`
- `src/main/lib/issue-id.ts`
- `src/main/services/spec-review-bridge.ts`
- `src/main/services/spec-review-revision.ts`
- `src/main/ipc/spec.ts`
- `src/main/ipc/register.ts`
- `src/main/preload.ts`
- `src/shared/forge-api.ts`
- `src/shared/ipc-channels.ts`
- `tests/shared/ipc-channels.test.ts`
- `tests/main/preload.test.ts`
- `tests/main/spec-review-bridge.test.ts`
- `tests/main/ipc-spec-review.test.ts`
- `tests/renderer/app.test.tsx`
- `tests/renderer/use-auth-status.test.ts`
- `tests/renderer/use-issues.test.ts`
- `tests/renderer/use-spec-stream.test.ts`

## Commit hash(es)

- `b64fecf`

## Self-review findings

- Bridge scope stayed intentionally thin and disposable; no lifecycle framework added.
- Unsafe issue ids are rejected before temp file writes or process spawn.
- Temp artifacts are outside `thoughts/` and cleaned in best-effort `finally`.
- Main/preload/shared API is wired end-to-end for `spec.launchReview`.
- IPC launch path does not call spec persistence.

## Tech-debt logged

- none

## Concerns

- none
