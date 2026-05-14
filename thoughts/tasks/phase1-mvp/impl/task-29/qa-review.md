# Task 29 QA Review (Re-review after fix commit `e690ab0`)

Verdict: ✅ Approved

## Strengths
- `registerAll` remains clean, straight-line dependency wiring (config/auth/linear/spec) with sensible DI boundaries. (`src/main/ipc/register.ts:53-79`)
- BrowserWindow boundary controls are intact for Phase 1: `contextIsolation: true`, `nodeIntegration: false`, and preload-based `window.forge` exposure. (`src/main/index.ts:12-17`, `out/preload/preload.mjs:1-34`)
- The prior preload runtime blockers (path mismatch + sandbox/ESM incompatibility) are concretely resolved in the current code + build output. (`src/main/index.ts:13-17`, `out/preload/preload.mjs:1-2`)

## Critical issues
- None.

## Important issues
- **Security tradeoff note (intentional): `sandbox: false` is now required for the current ESM preload output to run.** This fixes the previous “preload never executes” failure mode, but it does reduce defense-in-depth versus the plan’s original `sandbox: true` snippet. Given `contextIsolation: true` + `nodeIntegration: false` are still enforced, this is an acceptable Phase 1 compatibility deviation, but it should be revisited if/when the preload build is switched to a sandbox-compatible format. (`src/main/index.ts:14-17`, `thoughts/tasks/phase1-mvp/plans/2026-05-12-phase1-mvp.md:3043-3050`)
- **Runtime dependency on repo paths remains a packaging hazard.** `registerAll` loads the Linear skill module and spec template from `appRoot/.agents/...` and `appRoot/docs/...`. This matches Phase 1’s “use the shared skill” intent, but will not survive packaging/asaring unless those paths are shipped as runtime resources and `app.getAppPath()` still points at a tree containing them. Not a Task 29 blocker for dev/preview, but still a real distribution constraint. (`src/main/ipc/register.ts:38-51`, `src/main/index.ts:28`)

## Minor issues
- **Phase 1 build is still plan-order blocked by Task 30’s renderer entrypoint.** `electron.vite.config.ts` expects `src/renderer/index.html` (`renderer.build.rollupOptions.input`), and `createWindow()` loads `../renderer/index.html` in production mode; the “build fails” state is already logged as Task 29 tech debt and should not re-fail Task 29 by itself. (`electron.vite.config.ts:12-16`, `src/main/index.ts:22-24`, `thoughts/tech-debt.md:58`)

## Drift detected
- Corrective drift vs plan snippet: preload output is `preload.mjs` (not `preload.js`) and sandbox must be disabled to execute the current ESM preload. This is a necessary alignment with the repo’s electron-vite output rather than scope creep. (`src/main/index.ts:13-17`, `out/preload/preload.mjs:1-2`, `thoughts/tasks/phase1-mvp/plans/2026-05-12-phase1-mvp.md:3038-3051`)
- No addendum/tooling-scope violations observed. (`thoughts/tasks/phase1-mvp/plans/2026-05-12-phase1-mvp.addendum.md:3-8`)

## Assessment
The previously-blocking preload issues are fixed: the main process now points at the actual electron-vite preload artifact (`../preload/preload.mjs`) and disables sandbox so the ESM preload executes, restoring the `window.forge` bridge needed for the renderer boundary. Remaining concerns are either intentional tradeoffs (sandbox) or Phase 1 scope constraints (packaging hazards, renderer entrypoint missing until Task 30) and are appropriately tracked/understood.
