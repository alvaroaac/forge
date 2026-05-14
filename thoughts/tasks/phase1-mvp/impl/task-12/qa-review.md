# Task 12 QA Review (Phase 1 MVP): Issues cache

✅ Approved

## Strengths

- `src/main/services/issues-cache.ts` is intentionally small, typed end-to-end, and comfortably under the cyclomatic complexity cap:
  - `read()` is a single guard + parse.
  - `write()` is straight-line (mkdir + write).
- Read/write behavior is sensible and consistent with Task 11’s `config-store` style:
  - Missing file returns `[]` (vs throwing).
  - Writes are pretty-printed JSON (`2`-space indent) and ensure parent directories exist.
- Tests are meaningful for the intended surface area. `tests/main/issues-cache.test.ts` covers:
  - missing-file returns `[]`
  - `write()` then `read()` round-trip of a representative `Issue`
- The implementer report is materially accurate:
  - Commit `5dc5a50` exists and includes only `src/main/services/issues-cache.ts` + `tests/main/issues-cache.test.ts`.
  - The reported command outcomes match current reruns (including the pre-existing lint warning).

## Issues

### Critical

- None.

### Important

- None.

### Minor

- Robustness nit (same class as Task 11): `read()` will throw if the cache file contains malformed JSON (`JSON.parse`). This is consistent with current Phase 1 services, and Task 12 correctly notes it as a concern. I do not consider this a blocker for Task 12, and I do not think it requires a new tech-debt entry if the plan/addendum expectation is “crash/throw on corrupt local state for MVP”; consider consolidating a single Phase 1 tech-debt item later to harden JSON-backed local persistence across services.
- Repo lint baseline still includes 1 warning unrelated to Task 12: `tests/main/paths.test.ts` imports `vi` but does not use it (`@typescript-eslint/no-unused-vars`). Task 12 did not introduce this.

## Drift Detected

- Repeated (pre-existing) drift pattern: the same non-fatal ESLint unused-import warning in `tests/main/paths.test.ts` noted in Task 10 QA and reiterated in Task 11 QA remains present. Task 12 did not worsen it, but it continues to show up in “commands should pass” runs.
- Repeated (accepted-for-now) robustness theme: multiple Phase 1 services (Task 11 `config-store`, Task 12 `issues-cache`) assume valid JSON and will throw on parse errors. Not drift from conventions, but worth tracking as a single future hardening task rather than ad hoc fixes.

## Assessment

Re-ran the required commands on the current working tree; all passed:

- `npx vitest run tests/main/issues-cache.test.ts`
- `npm run test`
- `npm run lint` (passes with 1 existing warning)
- `npm run typecheck`
- `npm run format:check`

No blocking code-quality issues remain in Task 12 scope.

