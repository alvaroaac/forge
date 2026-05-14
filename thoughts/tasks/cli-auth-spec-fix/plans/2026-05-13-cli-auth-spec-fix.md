# 2026-05-13 CLI Auth, Spec Generation, and Detail Drawer Patch

## Context

Phase 1 MVP is testable in the Electron app, but three runtime behaviors are misleading or broken:

1. The navbar reports Claude, Codex, and Linear as connected even when it has only checked that a binary or token file exists.
2. Generate Spec currently depends on Anthropic API key auth, but the product constraint is CLI login only: the user should be able to log in to Claude Code and Codex using their CLIs, with no API key required.
3. The issue detail drawer can show no description even when the user expects useful Linear detail. At minimum, opening a drawer must fetch fresh issue detail instead of trusting stale list cache data, and empty Linear descriptions must be surfaced honestly.

## Non-Negotiable Constraints

- Do not attempt to authenticate on behalf of the user.
- Do not require `ANTHROPIC_API_KEY` for spec generation.
- Keep renderer code free of Node APIs; all filesystem, CLI, and network work stays in main process services or IPC.
- Preserve the existing `window.forge` IPC boundary and streaming contract for spec generation.
- Use the project Linear skill client under `.agents/skills/linear/`; extend it in place if a new read operation is needed.
- Follow TDD where practical: add or update focused tests before/with behavior changes.
- Keep intentionally deferred work logged in `thoughts/tech-debt.md`.

## Task 1: Make Auth Status Truthful

### Problem

`src/main/services/auth-checker.ts` currently treats CLI availability and token-file presence as connection health. That makes the navbar claim "connected" when Claude or Codex is not logged in, or when a Linear token is unreadable/invalid.

### Requirements

- Claude status must verify logged-in CLI usability by running `claude auth status`.
- Codex status must verify logged-in CLI usability by running `codex login status`.
- Linear status must verify API usability with a lightweight GraphQL `viewer { id }` request using the configured OAuth token file or `LINEAR_API_KEY`.
- `AuthStatus` can remain boolean-valued for Phase 1, but each boolean must mean "usable now", not "installed/configured".
- Keep failures non-fatal: an unavailable CLI, missing token, invalid token, GraphQL error, timeout, or thrown exception should return `false` for that service.
- Update tests so the previous false-positive behavior is no longer accepted.

### Suggested Files

- `src/main/services/auth-checker.ts`
- `src/main/ipc/auth.ts`
- `tests/main/auth-checker.test.ts`
- `tests/main/ipc-auth.test.ts`

### Acceptance Criteria

- Tests prove `claude --version` / `codex --version` style checks are no longer enough.
- Tests prove Linear status only returns true after a successful viewer query.
- Existing renderer auth polling can keep using the same `AuthStatus` shape.

## Task 2: Generate Specs Through Logged-In Claude CLI

### Problem

Spec generation currently instantiates the Anthropic SDK and fails without `ANTHROPIC_API_KEY`. The app should use the user's logged-in Claude CLI session instead.

### Requirements

- Replace Anthropic SDK runtime generation with a Claude CLI implementation.
- Use `claude -p` / print mode, pass the configured model, system prompt, and issue prompt without shell interpolation.
- Do not use `--bare`; it explicitly avoids OAuth/keychain auth.
- Preserve the existing spec generation IPC contract:
  - emit `SpecGenerateChunk` messages with text as it arrives, or at least the final text if the CLI buffers;
  - emit `SpecGenerateDone` after successful persistence;
  - emit `SpecGenerateError` on failure.
- Persist generated specs to the same `thoughts/tasks/<issue-id>/initial-spec.md` path as before.
- Remove runtime dependency on `new Anthropic()` from the Electron main registration path.
- Keep CLI failures legible in the UI/logs, including stderr where available.

### Suggested Files

- `src/main/services/spec-generator.ts`
- `src/main/ipc/spec.ts`
- `src/main/ipc/register.ts`
- `src/main/lib/exec.ts` if a reusable spawn helper is warranted
- `tests/main/spec-generator.test.ts`
- `tests/main/ipc-spec-generate.test.ts`

### Acceptance Criteria

- Tests prove the generator invokes `claude` with argument arrays, not string-built shell commands.
- Tests prove stdout chunks are forwarded to `onChunk` and returned as final content.
- Tests prove nonzero CLI exit rejects with a useful error.
- Main IPC registration no longer constructs an Anthropic SDK client for spec generation.

## Task 3: Fetch Fresh Linear Detail for the Drawer

### Problem

The drawer currently renders the issue object from the cached issue list. If the list payload has an empty description or stale fields, the detail drawer incorrectly appears authoritative.

### Requirements

- Add a main-process issue-detail read path using the project Linear skill client.
- Extend `.agents/skills/linear/reference/linear.mjs` in place to fetch a single issue with at least:
  - `id`
  - `identifier`
  - `title`
  - `description`
  - `state`
  - `priority`
  - `labels`
  - `url`
  - `updatedAt`
- Add IPC and preload exposure for renderer code to request fresh detail for a selected issue.
- When the drawer opens or its selected issue changes, fetch fresh detail and replace the drawer issue only if it still matches the open drawer.
- If Linear returns an empty description, show the honest fallback text: `No Linear issue description returned.`
- Do not implement Linear comments/body fallbacks in this patch unless investigation proves the expected content is in an already-modeled issue field. If comments are intentionally deferred, log that in `thoughts/tech-debt.md`.

### Suggested Files

- `.agents/skills/linear/SKILL.md`
- `.agents/skills/linear/reference/linear.mjs`
- `src/main/services/linear-service.ts`
- `src/main/ipc/linear.ts`
- `src/main/ipc/register.ts`
- `src/main/preload.ts`
- `src/shared/ipc-channels.ts`
- `src/shared/forge-api.ts`
- `src/renderer/App.tsx`
- `src/renderer/components/detail-tab.tsx`
- Relevant tests under `tests/main`, `tests/renderer`, and `tests/shared`

### Acceptance Criteria

- Tests prove the Linear skill single-issue query returns full detail including description.
- Tests prove main IPC exposes the detail fetch and maps the result to the shared `Issue` shape.
- Tests prove the detail drawer fallback text is honest when description remains empty.
- Manual app flow: refresh issues, open an issue drawer, and observe that a fresh detail request occurs.

## Final Verification

- Run targeted tests for all touched main, shared, and renderer modules.
- Run the full test suite if time allows and failures are not unrelated pre-existing artifacts.
- Start the app and manually verify:
  - navbar status no longer claims Claude/Codex connected unless their auth status commands succeed;
  - Generate Spec invokes the Claude CLI path and no longer asks for `ANTHROPIC_API_KEY`;
  - detail drawer opens and fetches fresh issue detail.
