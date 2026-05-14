# Task 2 Progress Report

Status: DONE

What was implemented

- Replaced Anthropic SDK spec streaming with Claude CLI execution in print mode:
  - Uses `claude` with argument array invocation (`-p`, `--model`, `--append-system-prompt`, prompt body).
  - Uses `spawn(..., { shell: false, stdio: ['ignore', 'pipe', 'pipe'] })` to avoid shell interpolation.
  - Streams stdout chunks to `onChunk` and accumulates full content for final return.
  - Rejects nonzero exits with legible errors that include exit code and stderr text when present.
- Updated spec generation IPC handler to remove runtime Anthropic dependency and call the new CLI-backed stream API.
- Ensured completion signaling happens after persistence:
  - `SpecStreamChunk` with `done: true` is sent only after `writeSpec` succeeds.
  - Added explicit `spec:generate-done` event emission.
  - Added explicit `spec:generate-error` emission with `{ issueId, message }` on failure.
- Removed `new Anthropic()` construction from main IPC registration path.

Files changed

- `src/main/services/spec-generator.ts`
- `src/main/ipc/spec.ts`
- `src/main/ipc/register.ts`
- `src/shared/ipc-channels.ts`
- `tests/main/spec-generator.test.ts`
- `tests/main/ipc-spec-generate.test.ts`
- `thoughts/tasks/cli-auth-spec-fix/impl/task-2/progress.md`

Tests run and results

- `pnpm vitest run tests/main/spec-generator.test.ts tests/main/ipc-spec-generate.test.ts tests/shared/ipc-channels.test.ts`
  - Passed: 3 test files, 7 tests.

Commits made

- None (not committed due existing dirty worktree context).

Self-review findings

- Scope stayed within spec generation and registration surfaces plus targeted tests and IPC channel constants.
- No shell-string command construction is used in the spec generator path.
- Streaming behavior remains compatible with existing renderer expectations (`SpecStreamChunk` continues unchanged), while adding explicit done/error events for observability.
- Persistence ordering is now correct relative to done signaling.

Tech-debt logged

- No intentional tech debt introduced for Task 2.

Concerns

- Running `pnpm vitest` in this environment causes Corepack to suggest/auto-add a `packageManager` field in `package.json`; that incidental change was reverted to keep task scope clean.

Controller follow-up after QA

- Exposed `spec:generate-done` and `spec:generate-error` through preload and the shared `ForgeApi` surface.
- Updated `useSpecStream` to subscribe to done/error events, stop streaming on error, and keep a visible `errorMessage` for the drawer.
- Passed `errorMessage` through `App` -> `SpecDrawer` -> `SpecTab`, where empty-state spec generation failures are rendered to the user.
- Added/updated renderer and preload tests for the new done/error path.
- Re-ran the affected slice:
  - `./node_modules/.bin/vitest run tests/main/auth-checker.test.ts tests/main/ipc-auth.test.ts tests/main/linear-skill-checkAuth.test.ts tests/main/linear-skill-getCurrentUser.test.ts tests/main/spec-generator.test.ts tests/main/ipc-spec-generate.test.ts tests/main/preload.test.ts tests/shared/ipc-channels.test.ts tests/renderer/use-spec-stream.test.ts tests/renderer/spec-tab.test.tsx tests/renderer/spec-drawer.test.tsx`
  - Result: 11 files passed, 43 tests passed.
- Second QA follow-up: `SpecTab` now renders the failure state even when partial streamed content exists, so a nonzero Claude CLI exit cannot look like a successful partial spec.
- Focused regression:
  - `./node_modules/.bin/vitest run tests/renderer/spec-tab.test.tsx tests/renderer/use-spec-stream.test.ts`
  - Result: 2 files passed, 16 tests passed.
- Typecheck follow-up:
  - Fixed the Claude CLI spawn test/runtime typing for `stdio: ['ignore', 'pipe', 'pipe']`.
  - `npm run typecheck` now passes.
- Model-selection follow-up:
  - Added a model picker to the spec UI.
  - `spec:generate` now accepts an optional model override and falls back to `cfg.claudeModel`.
  - The selected model is persisted with `config:set` and also passed directly into the generation call to avoid a config-write race.
- Wider regression:
  - `./node_modules/.bin/vitest run tests/main/auth-checker.test.ts tests/main/ipc-auth.test.ts tests/main/linear-skill-checkAuth.test.ts tests/main/linear-skill-fetchIssueDetail.test.ts tests/main/linear-skill-getCurrentUser.test.ts tests/main/linear-service.test.ts tests/main/ipc-linear.test.ts tests/main/spec-generator.test.ts tests/main/ipc-spec-generate.test.ts tests/main/preload.test.ts tests/shared/ipc-channels.test.ts tests/renderer/use-spec-stream.test.ts tests/renderer/spec-tab.test.tsx tests/renderer/spec-drawer.test.tsx tests/renderer/detail-tab.test.tsx tests/renderer/app.test.tsx tests/renderer/use-auth-status.test.ts tests/renderer/use-issues.test.ts`
  - Result: 18 files passed, 77 tests passed.
