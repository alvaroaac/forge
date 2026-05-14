# Task 18 — Spec Review

Verdict: ✅ Compliant

Checked addendum: `thoughts/tasks/phase1-mvp/plans/2026-05-12-phase1-mvp.addendum.md` (no violations observed; only target files were modified for Task 18, and tooling checks were reported without rewriting reference/protocol dirs).

## Requirements Verification

- Modified files:
  - `src/main/services/linear-service.ts` (exports + mapping + fetchIssues) — see lines 1-45.
  - `tests/main/linear-service.test.ts` (added `mapIssue` tests) — see lines 1-52.

- `mapIssue` export present and uses shared `Issue` + mapping helpers:
  - Imports `Issue` type (`linear-service.ts:1`) and mapping helpers (`linear-service.ts:2`).
  - Exports `mapIssue(raw)` (`linear-service.ts:26`).

- `mapIssue` mapping rules:
  - `id` uses `raw.identifier` (`linear-service.ts:30`).
  - `description` normalizes null to empty string via `raw.description ?? ''` (`linear-service.ts:32`).
  - `status` and `priority` mapped via helpers (`linear-service.ts:33-34`).
  - `labels` extracted from `raw.labels.nodes[].name` (`linear-service.ts:27,35`).
  - `url`, `updatedAt` passthrough (`linear-service.ts:36-37`).
  - `isBug` computed with `issueType: null` (`linear-service.ts:38`).

- `fetchIssues(client)` export and implementation:
  - Exported (`linear-service.ts:42`).
  - Uses `fetchRaw(client)` then `raw.map(mapIssue)` (`linear-service.ts:43-45`).

- Tests added for `mapIssue`:
  - Full raw issue maps to internal `Issue` with:
    - identifier-as-id, description, status `todo`, priority `high`, labels, url, updatedAt, `isBug: true`
    - Covered by `maps raw Linear issue to internal Issue` (`linear-service.test.ts:10-33`).
  - Null description becomes empty string; done/none/isBug false:
    - Covered by `treats null description as empty string` (`linear-service.test.ts:35-51`).

- TDD “red” evidence (initial failure when `mapIssue` not exported):
  - Progress report includes a concrete failing run against parent snapshot with:
    - Command: `npx vitest run tests/main/linear-service.test.ts`
    - Failure: `TypeError: mapIssue is not a function`
    - See `thoughts/tasks/phase1-mvp/impl/task-18/progress.md` section “What you tested…”.

- Complexity:
  - `mapIssue` and `fetchIssues` are straight-line (no branching) and appear to be within the requested complexity limit (<= 2) (`linear-service.ts:26-45`).

- Checks + commit:
  - Progress reports task test + full checks run (`vitest`, `npm run test`, `typecheck`, `lint`, `format:check`) with PASS results (lint warning noted as pre-existing and unrelated).
  - Commit exists with required message:
    - `14b1ecda935710255d6d0df8f7e9e4c7e239176e` — `feat(main): map raw Linear → internal Issue`.

