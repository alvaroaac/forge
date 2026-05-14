# Task 3 Spec Review — Fetch Fresh Linear Detail for the Drawer

✅ Spec compliant.

## Evidence Reviewed

- `.agents/skills/linear/reference/linear.mjs` now exposes `fetchIssueDetail(identifier)` and queries `id`, `identifier`, `title`, `description`, `state`, `priority`, `labels`, `url`, and `updatedAt`.
- `.agents/skills/linear/SKILL.md` documents the new single-issue detail read.
- `src/main/services/linear-service.ts` maps the detail payload into the shared `Issue` shape and returns `null` when Linear returns no issue.
- `src/main/ipc/linear.ts`, `src/main/preload.ts`, `src/shared/ipc-channels.ts`, and `src/shared/forge-api.ts` expose `linear:fetch-issue-detail` through the existing IPC/preload boundary.
- `src/renderer/app.tsx` fetches fresh detail on drawer issue open/change and applies it only if the currently open drawer still matches the requested issue id.
- `src/renderer/components/detail-tab.tsx` now renders the exact fallback copy: `No Linear issue description returned.`
- Comments/body fallback was intentionally deferred and logged in `thoughts/tech-debt.md`.

## Verification

- `npm run typecheck`
- `./node_modules/.bin/vitest run tests/main/linear-skill-fetchIssueDetail.test.ts tests/main/linear-service.test.ts tests/main/ipc-linear.test.ts tests/main/preload.test.ts tests/shared/ipc-channels.test.ts tests/renderer/detail-tab.test.tsx tests/renderer/app.test.tsx`
- Wider focused regression passed with the current code state.

## Tech-Debt Accounting

- Logged: Linear comments/body synthesis fallback remains deferred until comment/reply modeling is added.
