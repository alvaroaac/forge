# Task 21 QA Review

## Status: Approved

## Reviewed Range
- Base: `e5a720aa63a56fa0497f9c06ff3ec0417f89deaa`
- Head: `858547fcd568f9ffccbd34a3efb36f433848820c`

## Artifact Check
- `thoughts/tasks/add-triage/impl/task-21/progress.md` exists.
- `thoughts/tasks/add-triage/impl/task-21/spec-review.md` exists and approves the task.
- No task addendum exists.
- User confirmed the spec is approved despite Draft status.

## Findings

### Critical
- None.

### Important
- None.

### Minor
- `src/renderer/app.tsx` still passes the active triage issue id into `useSpecStream`, so opening a triage issue can still initialize spec-stream subscriptions and call `window.forge.spec.get()` even though `SpecDrawer` is not rendered. This is not blocking because spec generation cannot be invoked from the triage UI and the requested drawer routing is correct, but a future cleanup could pass `null` to `useSpecStream` when `drawer.issue.status === 'triage'`.

## Code Quality Notes
- `src/renderer/app.tsx` now routes active triage issues through `TriageDrawerContainer`, while non-triage issues continue to render through `SpecDrawer`.
- `TriageDrawerContainer` owns `useTriageStream(issue.id)` and forwards `brief`, `streaming`, `isStreaming`, `errorMessage`, `onGenerate`, `canGenerate`, `issue`, and `onClose` to `TriageDrawer`.
- The default app tab remains `Todo`; no issue-list selection behavior was changed.
- `tests/renderer/app.test.tsx` adds coverage that opening a triage issue renders the triage drawer state and leaves the spec drawer state unset.

## Drift Check
- Read prior QA reviews for Tasks 1 through 20 from this worktree before writing this review.
- No blocking behavioral or code-quality drift detected against prior approved tasks.
- The Task 12 non-blocking atomic-create hardening note remains isolated to `triage-writer` and is not affected by this app routing task.
- The Task 16 test-only `any` note in `tests/main/preload.test.ts` remains unrelated.
- The Task 20 app-level viewer-id rejection note remains unrelated to this drawer-routing change.

## Verification
- `npm test -- tests/renderer/app.test.tsx` passed: 9 tests.
- `npm run typecheck` passed.

## Assessment
Approved. Task 21 correctly separates triage and non-triage drawer rendering, moves triage stream ownership into a dedicated container, and passes the requested focused test plus full typecheck. The only note is a non-blocking cleanup opportunity to avoid spec-stream setup while a triage issue is active.
