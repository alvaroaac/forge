# Task 46 QA Review

## Verdict
✅ Approved

## Strengths
- E2E smoke scope is appropriately minimal and clearly asserts the three key UI anchors without reaching into volatile Linear/Claude network behavior. (`tests/e2e/smoke.spec.ts:12-14`)
- Process cleanup is handled even on assertion failure via `try/finally` with an explicit `app.close()`, reducing the risk of orphaned Electron processes. (`tests/e2e/smoke.spec.ts:7-19`)
- Playwright config matches the plan and keeps the run deterministic for Electron by avoiding parallel execution. (`playwright.config.ts:3-8`)
- The built-launch bootstrap fix is small, typed, and low-complexity: the resolver is a straightforward upward walk with a clear marker predicate and bounded fallback behavior. (`src/main/lib/app-root.ts:4-30`)
- Main-process startup is wrapped in an async `start()` with a top-level `.catch(...)` that logs and exits on startup failure, preventing silent hangs. (`src/main/index.ts:28-41`)
- Regression test coverage exists for the root resolver's two intended behaviors (walk-up from `out/main`, and fallback to `cwd`). (`tests/main/app-root.test.ts:17-36`)

## Critical issues
- None.

## Important issues
- None.

## Minor issues
- **E2E assertion timeout is still Playwright's default (5s).** The test-level `timeout: 60_000` in config does not extend individual `expect(...)` retries; on slower machines/CI, `toHaveText` / `toBeVisible` could fail early even though the overall test timeout is generous. Consider setting a global `expect: { timeout: ... }` in `playwright.config.ts` or passing per-assertion timeouts. (`playwright.config.ts:3-8`, `tests/e2e/smoke.spec.ts:12-14`)
- **E2E launch path depends on `process.cwd()`.** This is consistent with the plan's snippet, but it makes the smoke test sensitive to being invoked from a different working directory (e.g. running Playwright from a parent dir). If this test ever needs to be runnable from arbitrary CWDs, consider resolving from the repo root (or deriving from `import.meta.url`). (`tests/e2e/smoke.spec.ts:8`)
- **Root resolution fallback increases "ambient authority" of CWD.** `resolveAppRoot(...)` will prefer a repo-root discovered from `process.cwd()` when `startDir` is outside the repo tree. That is convenient for the local/dev + built-output case, but it also means the runtime module/template resolution can be influenced by the caller's working directory. This is already in the neighborhood of the packaging hazard noted earlier, but worth keeping in mind as the app moves toward being distributed. (`src/main/lib/app-root.ts:28-30`)

## Drift call-outs vs prior tasks
- This change is consistent with Task 29's known constraint that the main process loads runtime resources from `appRoot/.agents/...` and `appRoot/docs/...`. Task 46 reduces the dev-build boot failure mode (where `app.getAppPath()` points at `out/main`) without attempting to "solve packaging" in Phase 1. (`src/main/index.ts:29`, `src/main/ipc/register.ts:38-51`, compare `thoughts/tasks/phase1-mvp/impl/task-29/qa-review.md`)
- No concerning drift vs the plan's Task 46 E2E intent: config values match, the smoke assertions stay at the UI-shell level, and cleanup is stronger than the plan's baseline. (`playwright.config.ts:3-8`, `tests/e2e/smoke.spec.ts:4-19`, compare plan section `thoughts/tasks/phase1-mvp/plans/2026-05-12-phase1-mvp.md:4937-4997`)

## Assessment
Within the reviewed scope, code quality is solid: functions remain under the cyclomatic complexity cap, types stay explicit, the Electron process is closed reliably in the E2E test, and the repo-root resolution fix is small and well-covered by unit tests.

No Critical/Important issues remain in the reviewed scope. ✅
