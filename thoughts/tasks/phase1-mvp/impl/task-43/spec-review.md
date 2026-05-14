# Task 43 Spec Review (Re-Review After QA Fix)

## Verdict
✅ Spec compliant (still compliant after StrictMode + ordering fix)

## Missing requirements
None.

## Extra scope
- **StrictMode safety (QA fix):** `useEffect` setup resets the mounted guard so the React 18 StrictMode setup-cleanup-setup cycle doesn't leave the hook inert. No public API change. See [use-issues.ts](/Users/alvarocarvalho/desenv/personal/forge/src/renderer/hooks/use-issues.ts:31) and the regression test [use-issues.test.ts](/Users/alvarocarvalho/desenv/personal/forge/tests/renderer/use-issues.test.ts:100).
- **Latest-result guard (QA fix):** overlapping `refresh()` calls are ordered via a monotonically increasing request id so stale results do not clobber newer state. No public API change. See [use-issues.ts](/Users/alvarocarvalho/desenv/personal/forge/src/renderer/hooks/use-issues.ts:11) and the regression test [use-issues.test.ts](/Users/alvarocarvalho/desenv/personal/forge/tests/renderer/use-issues.test.ts:71).
- **Rejection handling (defensive):** preload rejections are swallowed to avoid unhandled promise rejections while preserving current state and defaults. No error state or retries were added. See [use-issues.ts](/Users/alvarocarvalho/desenv/personal/forge/src/renderer/hooks/use-issues.ts:26) and [use-issues.test.ts](/Users/alvarocarvalho/desenv/personal/forge/tests/renderer/use-issues.test.ts:172).

## Misunderstandings
None found.

## Addendum-rule check
Addendum tooling scope respected. Task 43 work is confined to the intended hook + its unit tests plus the task artifacts under `thoughts/tasks/phase1-mvp/impl/task-43/` (no opportunistic rewrites of `.agents/`, `resources/design/`, `scripts/orchestrator-core/`, or other reference/protocol directories).

## Tech-debt-accounting check
Progress reports "Tech-debt logged: None", and no `[Task 43]` entry exists in `thoughts/tech-debt.md`. This is consistent. See [progress.md](/Users/alvarocarvalho/desenv/personal/forge/thoughts/tasks/phase1-mvp/impl/task-43/progress.md:30).

## Evidence
- Task 43 requirements (seed-then-refresh + 60s polling + cleanup + return shape): [2026-05-12-phase1-mvp.md](/Users/alvarocarvalho/desenv/personal/forge/thoughts/tasks/phase1-mvp/plans/2026-05-12-phase1-mvp.md:4660)
- Hook returns exactly `{ issues, lastSync, refresh }` (no extra API surface): [use-issues.ts](/Users/alvarocarvalho/desenv/personal/forge/src/renderer/hooks/use-issues.ts:64)
- Initial state is `issues = []` and `lastSync = 0`: [use-issues.ts](/Users/alvarocarvalho/desenv/personal/forge/src/renderer/hooks/use-issues.ts:8), test: [use-issues.test.ts](/Users/alvarocarvalho/desenv/personal/forge/tests/renderer/use-issues.test.ts:60)
- `refresh()` is awaitable and calls `window.forge.linear.refresh()`; on success updates `issues` + `lastSync`: [use-issues.ts](/Users/alvarocarvalho/desenv/personal/forge/src/renderer/hooks/use-issues.ts:13), window API typing: [forge-api.ts](/Users/alvarocarvalho/desenv/personal/forge/src/shared/forge-api.ts:7), test: [use-issues.test.ts](/Users/alvarocarvalho/desenv/personal/forge/tests/renderer/use-issues.test.ts:119)
- On mount, seeds from `window.forge.linear.fetch()` then triggers refresh: [use-issues.ts](/Users/alvarocarvalho/desenv/personal/forge/src/renderer/hooks/use-issues.ts:36), test: [use-issues.test.ts](/Users/alvarocarvalho/desenv/personal/forge/tests/renderer/use-issues.test.ts:71)
- Polling runs every `60_000ms` and interval is cleared on cleanup/unmount: [use-issues.ts](/Users/alvarocarvalho/desenv/personal/forge/src/renderer/hooks/use-issues.ts:5), test: [use-issues.test.ts](/Users/alvarocarvalho/desenv/personal/forge/tests/renderer/use-issues.test.ts:139)
- StrictMode regression from prior QA review is addressed and locked in by test coverage: prior failure description [qa-review.md](/Users/alvarocarvalho/desenv/personal/forge/thoughts/tasks/phase1-mvp/impl/task-43/qa-review.md:12), fix in code [use-issues.ts](/Users/alvarocarvalho/desenv/personal/forge/src/renderer/hooks/use-issues.ts:32), test [use-issues.test.ts](/Users/alvarocarvalho/desenv/personal/forge/tests/renderer/use-issues.test.ts:100)
- "Latest refresh wins" regression from prior QA review is addressed and locked in by test coverage: [use-issues.ts](/Users/alvarocarvalho/desenv/personal/forge/src/renderer/hooks/use-issues.ts:14), test [use-issues.test.ts](/Users/alvarocarvalho/desenv/personal/forge/tests/renderer/use-issues.test.ts:92)
- Progress artifact includes test evidence + commit hashes (including QA fix commit): [progress.md](/Users/alvarocarvalho/desenv/personal/forge/thoughts/tasks/phase1-mvp/impl/task-43/progress.md:10)
  - `df17de3f51ba81ef7fb6fbaca913d8d8dcd9773f` feat: hook + polling
  - `d0f09e68e73b48d1466d075f7b49d5ece9fb402a` fix: StrictMode safety
