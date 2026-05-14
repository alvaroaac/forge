# Task 29 Spec Review (Re-review after QA fix commit `e690ab0`)

Verdict: ✅ Spec compliant (with one justified corrective deviation: ESM preload output requires `preload.mjs`, and `sandbox: false` is accepted here as the practical compatibility fix while keeping the other security controls intact)

## Missing requirements
- None in Task 29-owned code.

## Extras / scope drift
- Minor implementation-shape differences from the plan snippet remain, but stay within Task 29 intent. `src/main/ipc/register.ts` loads the Linear skill module via an app-root-relative dynamic import (still consuming `.agents/skills/linear/reference/linear.mjs`, no hand-rolled GraphQL), and the `registerLinearHandlers` wiring uses a narrow adapter closure around `fetchIssues` to satisfy typing/dependency shape.
- QA fix commit `e690ab0` changes the preload output filename and sandbox setting versus the plan snippet (details below); this is treated as a corrective drift to match electron-vite’s emitted preload format, not added scope.

## Plan alignment / deviations (Task 29 focus)
- `src/main/ipc/register.ts`: Aligned with the plan’s `registerAll(...)` behavior (creates store/cache, reads config, creates Linear client from config, creates Anthropic client, loads template with existence guard, registers config/auth/linear/spec handlers).
- `src/main/index.ts`: Aligned with the plan’s lifecycle + window behavior (BrowserWindow size/background, `ELECTRON_RENDERER_URL` dev path, `../renderer/index.html` prod path, calls `registerAll(ipcMain, app.getAppPath())` before creating the window).
- **ESM preload correction (accepted):** Plan snippet hardcodes `preload: .../preload.js` and `sandbox: true`, but current code uses `preload: .../preload.mjs` and `sandbox: false`. This is acceptable as a necessary correction for this repo’s electron-vite build output: the preload bundle currently emits to `out/preload/preload.mjs`, so pointing BrowserWindow at `preload.js` would be wrong at runtime. Disabling sandbox is accepted here as the compatibility fix to ensure the ESM preload executes, while maintaining `contextIsolation: true` and `nodeIntegration: false` and relying on the existing `contextBridge` API surface from Task 28.

## Misunderstandings
- The plan’s Task 29 Step 3 expects `npm run build` to succeed, but the same plan schedules creation of the renderer entrypoint (`src/renderer/index.html`) in Task 30. Build failure prior to Task 30 is therefore an expected plan-order dependency, not a Task 29 logic defect, as long as it is explicitly deferred and tracked (see Tech Debt section).

## Addendum-rule check
- No violations observed. The addendum’s “Tooling Scope” constraints (don’t rewrite reference/protocol dirs; scope lint/format appropriately) are respected by the Task 29 changes and artifacts.

## Tech-debt-accounting check
- Complete.
- Task 29 build deferral (full `npm run build` verification blocked by Task 30 renderer scaffold) remains explicitly recorded in `thoughts/tasks/phase1-mvp/impl/task-29/progress.md` and in `thoughts/tech-debt.md` as `[2026-05-13][Task 29] ... Deferred full npm run build verification until Task 30 ...`.

## Evidence
- Plan requirements for Task 29 (files + `registerAll` / `createWindow` implementations + build expectation + original sandbox/preload snippet) are in `thoughts/tasks/phase1-mvp/plans/2026-05-12-phase1-mvp.md:2982-3077`.
- `src/main/ipc/register.ts` wiring matches the planned structure: it loads the Linear skill module from `.agents/skills/linear/reference/linear.mjs` (documented in `.agents/skills/linear/SKILL.md`) via app-root-relative dynamic import, then reads config before creating the Linear client, then registers config/auth/linear/spec handlers.
- `src/main/index.ts` matches the planned BrowserWindow + lifecycle behavior, with the QA-fix corrections applied: preload path now targets `../preload/preload.mjs` (electron-vite output) instead of the plan’s `preload.js`, and the `sandbox: false` deviation is paired with `contextIsolation: true` and `nodeIntegration: false` (security posture preserved at the boundary level for Phase 1).
- Electron build config indicates the preload entrypoint is `src/main/preload.ts`, consistent with producing the `out/preload/preload.mjs` artifact used by `src/main/index.ts` (see `electron.vite.config.ts` preload build input + renderer input for Task 30 dependency).
