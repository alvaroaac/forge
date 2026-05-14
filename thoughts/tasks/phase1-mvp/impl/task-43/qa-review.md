# Task 43 QA Review

## Verdict
✅ Approved

## Strengths
- **StrictMode-safe lifecycle:** the effect setup resets the mounted guard (`isActiveRef.current = true`) so React 18’s dev-only setup-cleanup-setup cycle can’t leave the hook inert. (`src/renderer/hooks/use-issues.ts:31-62`, `src/renderer/main.tsx:6-11`)
- **StrictMode regression test added:** the suite now renders the hook under `<StrictMode>` and asserts the hook still seeds and refreshes correctly. (`tests/renderer/use-issues.test.ts:100-117`)
- **Overlapping refresh ordering is guarded:** a monotonic `refreshIdRef` ensures stale overlapping refresh results don’t clobber newer state, and this is locked in by a test that resolves the initial mount refresh after a later manual refresh. (`src/renderer/hooks/use-issues.ts:11-26`, `tests/renderer/use-issues.test.ts:71-98`)
- **Polling cleanup is correct and tested:** interval is cleared on unmount and refresh does not continue firing afterward. (`src/renderer/hooks/use-issues.ts:53-61`, `tests/renderer/use-issues.test.ts:139-170`)
- **No unhandled rejections surfaced:** both `fetch()` and `refresh()` rejections are swallowed and tests prove no `unhandledrejection` event fires while defaults/seeded state remain stable. (`src/renderer/hooks/use-issues.ts:17-28,36-48`, `tests/renderer/use-issues.test.ts:172-224`)

## Critical issues
None.

## Important issues
None.

## Minor issues
- **Latest-request-wins tradeoff (document as intended behavior):** the request-id guard means that if a newer refresh starts and then rejects, an older in-flight refresh that later succeeds will still be discarded as “stale”. This is consistent with “latest request wins”, but it’s a conscious semantics choice worth remembering if users ever complain about “refresh did nothing” under flaky connections. (`src/renderer/hooks/use-issues.ts:13-26`)
- **Polling test still uses a microtask flush that’s a bit opaque:** `await Promise.resolve()` is used to allow the mount refresh to run before asserting call counts; a `waitFor(() => expect(refresh)... )` would read clearer and be less scheduling-sensitive, though the current test is passing and deterministic in practice. (`tests/renderer/use-issues.test.ts:149-153`)

## Drift call-outs vs prior tasks
- **No concerning drift vs Task 42 hook posture:** Task 43 now matches the “StrictMode-safe lifecycle + swallow preload rejections + deterministic tests” approach established in Task 42’s renderer hooks QA. (`thoughts/tasks/phase1-mvp/impl/task-42/qa-review.md:7-29`, `src/renderer/hooks/use-issues.ts:31-62`, `tests/renderer/use-issues.test.ts:100-117,172-224`)
- **Beneficial drift:** the overlap-ordering guard and its regression test go beyond the original Task 43 plan sketch, but they directly address a real race identified in the prior QA review without expanding the public hook API. (`src/renderer/hooks/use-issues.ts:11-26`, `tests/renderer/use-issues.test.ts:71-98`)

## Assessment
The previous blockers are resolved:
1. StrictMode setup-cleanup-setup no longer leaves the hook inert, and this is explicitly tested. (`src/renderer/hooks/use-issues.ts:31-62`, `tests/renderer/use-issues.test.ts:100-117`)
2. Overlapping refresh calls are ordered so stale results can’t clobber newer state, and this is explicitly tested. (`src/renderer/hooks/use-issues.ts:11-26`, `tests/renderer/use-issues.test.ts:71-98`)

No Critical/Important issues remain in the reviewed scope. ✅
