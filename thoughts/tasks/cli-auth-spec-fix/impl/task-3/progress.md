# Task 3 Progress — Fetch Fresh Linear Detail for the Drawer

## Status

✅ Completed

## Files Changed

- `.agents/skills/linear/SKILL.md`
- `.agents/skills/linear/reference/linear.mjs`
- `src/main/services/linear-service.ts`
- `src/main/ipc/linear.ts`
- `src/main/ipc/register.ts`
- `src/main/preload.ts`
- `src/shared/ipc-channels.ts`
- `src/shared/forge-api.ts`
- `src/renderer/app.tsx`
- `src/renderer/components/detail-tab.tsx`
- `tests/main/linear-skill-fetchIssueDetail.test.ts` (new)
- `tests/main/linear-service.test.ts`
- `tests/main/ipc-linear.test.ts`
- `tests/main/preload.test.ts`
- `tests/shared/ipc-channels.test.ts`
- `tests/renderer/detail-tab.test.tsx`
- `tests/renderer/app.test.tsx` (new)
- `thoughts/tech-debt.md`

## What Was Built

- Added a new Linear skill read operation: `fetchIssueDetail(identifier)` returning full issue detail (`id`, `identifier`, `title`, `description`, `state`, `priority`, `labels`, `url`, `updatedAt`).
- Added main-process detail mapping path in `linear-service` with `fetchIssueDetail(...)` to map raw Linear payload to shared `Issue`.
- Added IPC channel and handler for detail fetch:
  - channel: `linear:fetch-issue-detail`
  - request payload: `{ issueId }`
  - return: `Issue | null`
- Exposed detail fetch over preload / `window.forge.linear.fetchIssueDetail(issueId)`.
- Updated drawer behavior in renderer `App`:
  - fetches fresh issue detail whenever drawer issue opens or selected issue changes.
  - applies response only if the open drawer still matches the originally requested issue id (stale response guard).
- Updated drawer empty-description fallback copy to:
  - `No Linear issue description returned.`

## Tests Run / Results

Command:

```bash
npx vitest run tests/main/linear-skill-fetchIssueDetail.test.ts tests/main/linear-service.test.ts tests/main/ipc-linear.test.ts tests/main/preload.test.ts tests/shared/ipc-channels.test.ts tests/renderer/detail-tab.test.tsx tests/renderer/app.test.tsx
```

Result:

- ✅ 7 test files passed
- ✅ 24 tests passed
- ❌ 0 failed

Additional verification:

- `npm run typecheck` initially failed on Task 2's Claude CLI spawn typing (`Type '"ignore"' is not assignable to type 'StdioPipe'`).
- Controller follow-up fixed the spawn/test typing for the actual stdio tuple.
- `npm run typecheck` now passes.
- Wider regression now passes:
  - `./node_modules/.bin/vitest run tests/main/auth-checker.test.ts tests/main/ipc-auth.test.ts tests/main/linear-skill-checkAuth.test.ts tests/main/linear-skill-fetchIssueDetail.test.ts tests/main/linear-skill-getCurrentUser.test.ts tests/main/linear-service.test.ts tests/main/ipc-linear.test.ts tests/main/spec-generator.test.ts tests/main/ipc-spec-generate.test.ts tests/main/preload.test.ts tests/shared/ipc-channels.test.ts tests/renderer/use-spec-stream.test.ts tests/renderer/spec-tab.test.tsx tests/renderer/spec-drawer.test.tsx tests/renderer/detail-tab.test.tsx tests/renderer/app.test.tsx tests/renderer/use-auth-status.test.ts tests/renderer/use-issues.test.ts`
  - Result: 18 files passed, 77 tests passed.

## Commits

- None (workspace is dirty with unrelated in-progress changes from other tasks/agents).

## Self-Review Findings

- Detail drawer no longer treats cached list payload as authoritative after open/change.
- Stale-request overwrite risk is covered by a renderer test and guarded in state update path.
- Shared/main/renderer contracts stay aligned (`ipc-channels` + `forge-api` + preload + IPC handler + service mapping).
- Fallback messaging now explicitly communicates missing description from Linear instead of implying hidden local fallback.

## Tech-Debt Logged

- Added to `thoughts/tech-debt.md`:
  - `[2026-05-13][Task 3] Linear issue drawer does not fall back to comments/body synthesis when issue.description is empty; it now shows an explicit empty-description message.`

## Concerns

- Manual desktop verification flow (open app, refresh, open drawer, observe fresh detail request) was not run in this task report; behavior is validated by targeted automated tests only.
