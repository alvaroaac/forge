# Task 28 QA Review

Verdict: ✅ Approved

## Strengths
- Preload surface is appropriately narrow for the renderer boundary: only `window.forge` is exposed via `contextBridge`, with no Node/Electron primitives (e.g. `ipcRenderer`) leaked to the renderer. (`src/main/preload.ts:1-29`, `src/shared/forge-api.ts:3-20`)
- IPC channel/payload mapping matches the main-process handlers:
  - `spec:get` / `spec:generate` send `{ issueId }` payloads matching handler signatures. (`src/main/preload.ts:15-16`, `src/main/ipc/spec.ts:72, 98`)
  - `spec:stream-chunk` listener receives the single payload arg emitted from main (`sender.send(channel, payload)`), so `(event, chunk)` typing is correct. (`src/main/preload.ts:18-20`, `src/main/ipc/spec.ts:62-69`)
  - `config:set` passes `patch` directly, matching `registerConfigHandlers`. (`src/main/preload.ts:25`, `src/main/ipc/config.ts:6-9`)
- `onChunk` subscribe/unsubscribe behavior is correct: it closes over a stable `listener` reference and returns an unsubscriber that calls `ipcRenderer.off(...)`. (`src/main/preload.ts:17-21`)
- Complexity stays well under the repo cap (max 4): this is straight-line mapping code with a single small closure. (`src/main/preload.ts:6-27`)
- Electron-vite config explicitly builds the preload entrypoint, so the new file is actually part of the build graph. (`electron.vite.config.ts:5-16`)

## Critical issues
- None

## Important issues
- None

## Minor issues
- The test is intentionally a light, compile-time contract check and does not exercise `src/main/preload.ts` at runtime (no assertion that `contextBridge.exposeInMainWorld('forge', ...)` is called, no “no extra exposed keys” check). That’s acceptable for Task 28 as scoped in the plan, but it does mean accidental runtime wiring mistakes in preload wouldn’t be caught here. (`tests/main/preload.test.ts:1-51`)
- `ipcRenderer.invoke(...)` is effectively untyped (`Promise<any>`), so the `ForgeApi` return types are compile-time intent rather than enforced IPC contracts. This is normal for Electron, but if you want stronger guarantees later, consider a typed IPC wrapper or explicit type assertions at the call sites. (`src/main/preload.ts:8-26`, `src/shared/forge-api.ts:3-20`)

## Drift detected
- None. No addendum/tooling-scope violations observed in the Task 28 change surface, and this task does not add to the previously logged “IPC test helper scaffolding duplication” tech debt (Tasks 26–27) since it doesn’t introduce new IPC handler test doubles. (`thoughts/tech-debt.md:57`, `thoughts/tasks/phase1-mvp/impl/task-27/qa-review.md:24-25`)

## Assessment
Task 28 cleanly establishes a minimal, typed `window.forge` surface via `contextBridge`, correctly maps all Phase 1 IPC channels/payloads (including streaming chunk subscription with proper unsubscribe), stays within the complexity cap, and remains within addendum scope. The only notable gap is that the preload test is intentionally type-level and won’t catch runtime wiring mistakes, which is acceptable for this plan step but worth keeping in mind if preload wiring becomes more complex.

