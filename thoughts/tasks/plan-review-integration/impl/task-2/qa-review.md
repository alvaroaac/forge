# Task 2 QA Review

## Strengths

- The external bridge stays thin and disposable. `launchSpecReview` validates the issue id before side effects, creates one OS temp directory, writes `review-input.md`, runs one `plan-review` process, reads `plan-review-output.md`, calls the Forge-owned revision path, and performs best-effort cleanup in `finally`.
- The `plan-review` command construction matches the plan exactly: `plan-review <input> --fresh --split-by heading -o file --output-file <output>`, with `shell: false` and no `-o claude` path.
- Cleanup behavior is covered for success, nonzero CLI exit, missing output, and cleanup failure. The implementation does not add a rich lifecycle/status framework.
- The renderer/main boundary remains intact. Renderer-facing code only adds the typed preload/API invoke surface, while Node APIs stay in the main process.
- The launch review IPC path returns the revised spec as a draft result and does not call spec persistence. The IPC test explicitly guards the failure path from invoking `writeSpec`.
- Task 2 tests are focused on the behavior that matters for the demo bridge: exact args, unsafe issue-id early rejection, cleanup attempts, IPC pass-through, and API shape.
- No unreasoned `any` was introduced in the reviewed Task 2 code.

## Issues

### Critical

- None.

### Important

- [src/main/ipc/spec.ts](/Users/alvarocarvalho/desenv/personal/forge/src/main/ipc/spec.ts:11): `SpecStreamChunk` is imported but unused, so `npm run lint` exits with an error. This unused import existed at the base SHA, but Task 2 rewrote this import line while adding `SpecReviewResult`, leaving current HEAD in a lint-failing state. Remove `SpecStreamChunk` from the import.

### Minor

- None.

## Drift detected

- None. Task 1's repeated issue classes were an invalid prompt contract and parser complexity. Task 2 does not repeat those patterns: it delegates parsing to the Task 1 parser, keeps the new revision orchestration small, and the bridge is intentionally simple.

## Assessment

- Result: changes requested.
- Reason: implementation behavior and tests are otherwise solid, but current HEAD should not leave a lint error in a touched source file.
- Verification run:
  - `npm test -- tests/shared/ipc-channels.test.ts tests/main/preload.test.ts tests/main/spec-review-bridge.test.ts tests/main/ipc-spec-review.test.ts` passed: 4 files / 9 tests.
  - `npm run typecheck` passed.
  - `npm test` passed: 44 files / 200 tests.
  - `npm run lint` failed with the unused `SpecStreamChunk` import above, plus two warnings that appear outside the Task 2 implementation surface.
