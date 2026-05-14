Status: DONE

Model Choice Audit: gpt-5.3-codex-spark

## What I implemented
- Added `src/main/services/issues-cache.ts` with the requested flat-JSON cache service:
  - `IssuesCache` interface with `read()` and `write(issues)` methods.
  - `read()` returns `[]` when cache path is missing.
  - `read()` parses JSON from disk when present.
  - `write()` creates parent directories recursively and writes pretty-printed JSON.
- Added `tests/main/issues-cache.test.ts` using the exact TDD flow from the task:
  - reads an empty array from a missing file
  - round-trips a sample issue through write then read

## What you tested and test results
- TDD red check: `npx vitest run tests/main/issues-cache.test.ts` (before implementation)  
  Failed at import resolution because `src/main/services/issues-cache` did not yet exist yet.
- `npx vitest run tests/main/issues-cache.test.ts` after implementation: **PASS** (`2 passed`)
- `npm run test` — PASS (`8 passed`)
- `npm run typecheck` — PASS
- `npm run lint` — PASS with pre-existing warning in `tests/main/paths.test.ts` (`@typescript-eslint/no-unused-vars` for unused `vi`)
- `npm run format:check` — PASS

## Files changed
- `src/main/services/issues-cache.ts` (new)
- `tests/main/issues-cache.test.ts` (new)
- `thoughts/tasks/phase1-mvp/impl/task-12/progress.md` (new)

## Self-review findings
- Scope is intentionally narrow: read/write only for cache persistence.
- Behavior matches Task 11 style and surrounding service patterns (`read`/`write`, sync defaults not required here).
- No additional abstraction or API surface introduced.

## Tech-debt logged
- None.

## Commits made
- `5dc5a50` — `feat(main): issues-cache flat-JSON read/write`

## Concerns
- `read()` assumes valid JSON; malformed cache files will throw on parse like other current Phase 1 services, and this is consistent with current conventions.
