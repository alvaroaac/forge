# Task 10 QA Review (Phase 1 MVP): Paths helper

✅ Approved

## Strengths

- `src/main/lib/paths.ts` is small, fully typed, and comfortably under the cyclomatic complexity cap (each function is straight-line; `expandHome` has a single guard). The implementation matches the Task 10 plan scaffold exactly.
- Path behavior is sensible for the required cases:
  - `expandHome('~/foo')` expands to the user home directory.
  - Absolute paths (and any non-`~` leading strings) pass through unchanged.
  - `forgeDir()`, `configPath()`, `issuesCachePath()` are platform-aware via `node:path.join`.
- The test is meaningful for the Phase 1 scope: it locks the intended `~/.forge` layout and verifies both `~` expansion and absolute-path passthrough.
- Verification is green on the current tree (rerun during this review):
  - `npx vitest run tests/main/paths.test.ts`: PASS
  - `npm run test`: PASS
  - `npm run typecheck`: PASS
  - `npm run lint`: PASS (with 1 warning)
  - `npm run format:check`: PASS
- Progress report is materially accurate: commit `873704f` exists with the stated message and changes only `src/main/lib/paths.ts` + `tests/main/paths.test.ts`, and the reported command results match what I observed (including the lint warning).

## Issues

### Critical

- None.

### Important

- None.

### Minor

- ESLint warning: `tests/main/paths.test.ts` imports `vi` but does not use it (`@typescript-eslint/no-unused-vars`). This is avoidable (the import can be removed), but the Phase 1 Task 10 plan’s canonical test scaffold includes `vi` in the import line; keeping it preserves exact plan fidelity and does not break `npm run lint` (warning only), so I am not treating it as a quality blocker for Task 10.
- Portability nit: the test’s expected values use string interpolation with `/` (e.g. `` `${homedir()}/foo` ``). On Windows, `path.join` will typically emit `\\` separators, so this test may fail if/when Windows CI is introduced. This is consistent with the Task 10 scaffold as written, but it’s worth normalizing to `join(...)` expectations in a later owning task.

## Drift Detected

- A prior recurring quality theme was “keep lint baseline clean / avoid unused imports” (notably addressed earlier in Phase 1). Task 10 reintroduces an unused-import lint warning, but it is limited to a single warning and is attributable to copying the Task 10 plan’s provided test scaffold verbatim.
- No addendum/tooling-scope drift observed: this task did not introduce opportunistic rewrites in `.agents/`, `thoughts/`, `resources/design/`, or `scripts/orchestrator-core/`.

## Assessment

Task 10 is clean and appropriately scoped. The new helpers are simple and typed, behavior matches the plan, tests cover the required cases, and the standard verification commands pass. The only defect is a single non-fatal lint warning in the test scaffold; it’s noted above, but not blocking for Phase 1 Task 10.

