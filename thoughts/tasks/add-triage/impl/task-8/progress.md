# Task 8 Progress

## Status: DONE

## What I implemented
- Added `computron` to `AuthStatus` in `src/shared/types.ts`.
- Extended auth checks to include Computron readiness:
  - `src/main/services/auth-checker.ts` now imports `checkComputron`, extends `checkAll` options with `computronRepoPath`, runs `checkComputron` in parallel with existing checks, and returns `{ linear, claudeCode, codex, computron }`.
  - `src/main/ipc/auth.ts` now passes `cfg.computronRepoPath` into `checkAll`.
- Updated `tests/main/auth-checker.test.ts` to include `computronRepoPath` in `checkAll` opts and added a focused test for a temporary dir containing `.git` returning `status.computron === true`.
- Updated `tests/main/ipc-auth.test.ts` expected payload to include `computron`.
- Updated renderer auth-status defaults and rendering/tests so new auth row is surfaced:
  - `src/renderer/hooks/use-auth-status.ts`
  - `src/renderer/components/top-bar.tsx`
  - `src/renderer/components/right-panel.tsx`
  - affected tests in `tests/renderer/top-bar.test.tsx`, `tests/renderer/right-panel.test.tsx`, `tests/renderer/use-auth-status.test.ts`, `tests/renderer/app.test.tsx`, `tests/shared/types.test.ts`, and `tests/main/preload.test.ts`.

## Tests
- `npm test -- tests/main/auth-checker.test.ts` (before implementation) — passed before changes (counter to requested expectation of failure).
- `npm run typecheck && npm test -- tests/main/auth-checker.test.ts tests/main/ipc-auth.test.ts` — passed.

## Self-review findings
- The auth status object is now consistently propagated from main through IPC to renderer.
- `auth` UI lists were extended to include `Computron`, but this naturally changed order/count assertions in existing tests.
- No implementation risks beyond expected TypeScript surface expansion.

## Commit SHA
- `feat(auth): include computron health in AuthStatus` — `b9629dc`

## Tech-debt logged
- None.
