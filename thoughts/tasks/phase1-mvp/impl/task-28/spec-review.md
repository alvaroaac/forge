# Task 28 Spec Review

Verdict: ✅ Spec compliant

## Missing requirements
- None

## Extras / scope drift
- None

## Misunderstandings
- None. The plan’s Step 2 expected `vitest` to fail with “module not found”, but because the test uses `import type` the runtime test will not fail on a missing module; the implementer captured the red signal via `npm run typecheck` instead, which is explicitly acceptable per the task instructions (see Evidence).

## Addendum-rule check
- Addendum “Tooling Scope” rules appear respected: Task 28 changes are scoped to the listed implementation/test/progress artifacts; no repo-wide formatting or reference/protocol directory churn is indicated. (Commit `9ac0652` touches only the task’s files.)

## Tech-debt-accounting check
- Complete. `progress.md` explicitly states “Tech-debt logged: None” and no skipped requirements were identified in the implementation.

## Evidence
- Plan requirements for Task 28 (file list + expected `ForgeApi` + preload mapping + `onChunk` unsubscribe): `thoughts/tasks/phase1-mvp/plans/2026-05-12-phase1-mvp.md:2873-2965`.
- Required files exist:
  - `src/shared/forge-api.ts` (created in commit `9ac0652`).
  - `src/main/preload.ts` (created in commit `9ac0652`).
  - `tests/main/preload.test.ts` (created in commit `9ac0652`).
- `ForgeApi` Phase 1 methods typed as required + `Window` augmentation:
  - `src/shared/forge-api.ts:3-20` (auth/linear/spec/config method surface and return types).
  - `src/shared/forge-api.ts:22-25` (`declare global` exposes `window.forge: ForgeApi`).
- Preload exposes `window.forge` via `contextBridge` and maps each method to the correct IPC channel/payload:
  - `src/main/preload.ts:6-26` (method-to-`ipcRenderer.invoke` mappings).
  - `src/main/preload.ts:15-16` (`spec.get`/`spec.generate` send `{ issueId }` payloads).
  - `src/main/preload.ts:24-25` (`config.get` uses `ConfigGet`; `config.set` invokes `ConfigSet` with `patch` payload).
  - IPC channel definitions match the names used:
    - `src/shared/ipc-channels.ts:2-9` (`AuthCheck`, `LinearFetchIssues`, `LinearRefresh`, `SpecGet`, `SpecGenerate`, `SpecStreamChunk`, `ConfigGet`, `ConfigSet`).
- `onChunk` subscribes to `SpecStreamChunk` channel and returns unsubscribe:
  - `src/main/preload.ts:17-21` (`ipcRenderer.on(IpcChannel.SpecStreamChunk, listener)` and returned `off(...)`).
  - Chunk typing aligns with shared type:
    - `src/shared/types.ts:42-46` (`SpecStreamChunk` is `{ issueId, delta, done }`).
- Test is a light contract check:
  - `tests/main/preload.test.ts:11-47` constructs `const api: ForgeApi = { ... }` with Phase 1 shape.
  - `tests/main/preload.test.ts:29-36` asserts `spec.onChunk` handler signature and chunk shape (`satisfies SpecStreamChunk`).
- Red/green evidence (typecheck vs runtime import elision) recorded in the implementer report:
  - `thoughts/tasks/phase1-mvp/impl/task-28/progress.md` (“npm run typecheck” FAIL before `forge-api.ts`, then PASS; `vitest` PASS both times due to `import type` runtime elision).
- Commit evidence:
  - `git show --stat 9ac0652` shows only Task 28 artifacts changed: `src/main/preload.ts`, `src/shared/forge-api.ts`, `tests/main/preload.test.ts`, and the task’s `progress.md`.

