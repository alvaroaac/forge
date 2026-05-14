Status: DONE

Model Choice Audit: gpt-5.3-codex-spark

## What I implemented
- Added `src/main/services/config-store.ts` with a small, main-process-only config store service that:
  - defines config defaults for `AppConfig` (`linearTokenPath`, `linearTeamKey`, `repoPath`, `claudeModel`),
  - reads and merges config from disk with defaults when present,
  - persists partial config patches by merging with existing values and writing pretty JSON.
- Added `tests/main/config-store.test.ts` with the two required tests:
  - defaults are returned when config file is missing,
  - partial patch write persists and merged values still keep defaults.
- Followed the plan’s explicit default path strategy (`join(homedir(), '.humanlayer', 'riptide', 'linear.json')`) rather than task-10 path helpers.

## What I tested and results
- Initial failing step (TDD): `npx vitest run tests/main/config-store.test.ts` → failed at module resolution because `src/main/services/config-store.ts` did not exist yet.
- After implementation: `npx vitest run tests/main/config-store.test.ts` → passed (`2 passed`).
- Full test suite: `npm run test` → passed (`7 passed`, `21 passed`).
- Typecheck: `npm run typecheck` → passed.
- Lint: `npm run lint` → passed with one pre-existing warning in `tests/main/paths.test.ts` (`vi` unused).
- Formatting: `npm run format:check` → passed.

## Files changed
- `src/main/services/config-store.ts` (new)
- `tests/main/config-store.test.ts` (new)
- `thoughts/tasks/phase1-mvp/impl/task-11/progress.md` (new report)

## Self-review findings
- Complexity is low and explicit; functions stay small and single-purpose.
- Merge behavior correctly preserves defaults when partial config is written.
- No assumptions beyond provided task spec/defaults were introduced.

## Tech-debt logged
- None added for this task.

## Commits made
- `7661ef3` — `feat(main): config-store with defaults + merge`

## Concerns
- `npm run lint` still reports one existing warning in `tests/main/paths.test.ts` (`vi` is defined but never used); this predates Task 11 and was not changed here.
