# Task 26 Progress

Status: DONE

Model used: gpt-5.3-codex-spark

Files changed:
- `src/main/ipc/spec.ts` (new)
- `tests/main/ipc-spec-get.test.ts` (new)
- `thoughts/tasks/phase1-mvp/impl/task-26/progress.md` (new)

Tests run + results, including red and green evidence:
- `npx vitest run tests/main/ipc-spec-get.test.ts` (before implementation)
  - FAIL: `Failed to load url ../../src/main/ipc/spec (resolved id: ../../src/main/ipc/spec) in /Users/alvarocarvalho/desenv/personal/forge/tests/main/ipc-spec-get.test.ts. Does the file exist?`
- `npx vitest run tests/main/ipc-spec-get.test.ts`
  - PASS: 1 file, 2 tests passed.
- `npm run lint`
  - PASS with pre-existing warning: `/Users/alvarocarvalho/desenv/personal/forge/tests/main/paths.test.ts` has `vi` unused.
- `npm run typecheck`
  - PASS.
- `npm run format:check`
  - PASS.
- `npx vitest run tests/main/ipc-spec-get.test.ts` (post-implementation re-run)
  - PASS: 1 file, 2 tests passed.

Commits made:
- `feat(ipc): spec:get reads thoughts/tasks/[id]/initial-spec.md`

Self-review findings:
- Implemented `specPath` helper to resolve `thoughts/tasks/<issueId>/initial-spec.md` from `cfg.repoPath`.
- Registered `IpcChannel.SpecGet` in `registerSpecGetHandler`.
- `SpecGet` handler returns `null` when file is missing.
- When present, it reads `initial-spec.md` content and returns:
  - `issueId` from payload,
  - `content` as raw file string,
  - `generatedAt` from `stat.mtime.toISOString()`,
  - `approved: false`.
- Added focused typed IPC tests (no raw `any` or `Function`), including both positive and missing-file scenarios.

Tech-debt logged:
- [2026-05-13][Task 26] Repeated IPC test helper scaffolding remains duplicated across IPC specs. Reason: deferred-phase. Re-evaluate: when the next IPC test suite is added or during Phase 1 cleanup.

Concerns:
- None.

## QA-fix (Task 26 path-traversal hardening)

Status: DONE

Files changed:
- `src/main/ipc/spec.ts`
- `tests/main/ipc-spec-get.test.ts`
- `thoughts/tasks/phase1-mvp/impl/task-26/progress.md`

Tests added:
- Added invalid `issueId` coverage in `tests/main/ipc-spec-get.test.ts` for path-separator and absolute-path style IDs.
- Added regression test ensuring traversal-like `issueId` fragments do not read files outside the repo-boundary.

Tests run:
- `npx vitest run tests/main/ipc-spec-get.test.ts`
- `npm run lint`
- `npm run typecheck`
- `npm run format:check`

Commit command:
- `git commit -m "fix(ipc): validate spec issue ids before reading files"`
