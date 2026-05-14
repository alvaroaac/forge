# Task 1 Progress — Make Auth Status Truthful

## Status

✅ Completed

## Files Changed

- `src/main/services/auth-checker.ts`
- `tests/main/auth-checker.test.ts`

## What Was Built

- Switched Claude auth health from version probing to usability probing:
  - `claude auth status`
- Switched Codex auth health from version probing to usability probing:
  - `codex login status`
- Replaced Linear token-presence check with real API usability check:
  - Sends `viewer { id }` GraphQL query to `https://api.linear.app/graphql`
  - Uses `LINEAR_API_KEY` when present, otherwise OAuth token file `access_token` as `Bearer ...`
  - Returns `false` on missing token, invalid token file, GraphQL errors, HTTP errors, timeout, or thrown exceptions
- Kept `AuthStatus` shape unchanged (`{ linear, claudeCode, codex }` booleans), but semantics are now “usable now.”

## Tests Run / Results

- `pnpm exec vitest run tests/main/auth-checker.test.ts tests/main/ipc-auth.test.ts`
  - ✅ `tests/main/auth-checker.test.ts` passed (10 tests)
  - ✅ `tests/main/ipc-auth.test.ts` passed (2 tests)

### Behavior Covered by Tests

- `checkAll` now calls:
  - `claude auth status`
  - `codex login status`
- Tests explicitly reject old false-positive checks:
  - not called with `claude --version`
  - not called with `codex --version`
- Linear only returns true when viewer query succeeds with a viewer id.
- Linear returns false when token exists but API call fails (including thrown errors).

## Commits

- None. Skipped due existing dirty worktree and user instruction to avoid unsafe history actions.

## Self-Review Findings

- Scope stayed within Task 1 auth status behavior and tests.
- No renderer/API contract changes were introduced.
- Failure handling is non-fatal per requirement.

## Tech-Debt Logged

- None for this task.

## Concerns

- Running `pnpm` in this environment auto-inserts a `packageManager` field in `package.json` via Corepack; I reverted that incidental change each time to keep task scope clean.

## Controller Follow-up After QA

- Moved Linear health checking out of `auth-checker.ts` and into the canonical `.agents/skills/linear` client as `checkAuth(tokenPath?)`.
- Updated auth IPC registration to pass the already-loaded Linear skill client into `checkAll`.
- Added `tests/main/linear-skill-checkAuth.test.ts` to pin successful configured OAuth token use, `LINEAR_API_KEY` precedence, non-2xx failure, GraphQL errors, and missing viewer ids.
- Re-ran the affected slice:
  - `./node_modules/.bin/vitest run tests/main/auth-checker.test.ts tests/main/ipc-auth.test.ts tests/main/linear-skill-checkAuth.test.ts tests/main/linear-skill-getCurrentUser.test.ts tests/main/spec-generator.test.ts tests/main/ipc-spec-generate.test.ts tests/main/preload.test.ts tests/shared/ipc-channels.test.ts tests/renderer/use-spec-stream.test.ts tests/renderer/spec-tab.test.tsx tests/renderer/spec-drawer.test.tsx`
  - Result: 11 files passed, 43 tests passed.
