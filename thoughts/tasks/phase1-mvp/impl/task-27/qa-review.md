# Task 27 QA Review

Verdict: ✅ Approved

## Strengths
- Clean dependency injection surface for spec generation (store/cache/context/prompt/stream/write are all injected and test-doubled cleanly). (`src/main/ipc/spec.ts:34-42`, `tests/main/ipc-spec-generate.test.ts:40-48, 75-127`)
- Streaming flow matches the Phase 1 contract: deltas are emitted over `IpcChannel.SpecStreamChunk` with `{ issueId, delta, done }`, and a terminal `{ delta: '', done: true }` chunk is emitted on success. (`src/main/ipc/spec.ts:62-69, 104-113`, `src/shared/ipc-channels.ts:5-7`, `src/shared/types.ts:42-46`, `tests/main/ipc-spec-generate.test.ts:141-152`)
- Prompt construction is integrated (repo context + issue details + template), and the test asserts key inclusion so regressions are harder. (`src/main/ipc/spec.ts:102-110`, `src/main/services/spec-prompt.ts:4-35`, `tests/main/ipc-spec-generate.test.ts:155-165`)
- Safe-id guarding is consistent with `spec:get` (same allowlist used before any filesystem path construction, and `spec:generate` rejects unsafe IDs before doing any spec work). (`src/main/ipc/spec.ts:12-59, 74-76, 101-103`, `tests/main/ipc-spec-generate.test.ts:195-221`, `tests/main/ipc-spec-get.test.ts:97-107`)
- Cyclomatic complexity stays under the repo cap (no nested branching in the generate handler; helpers remain small). (`src/main/ipc/spec.ts:44-60, 95-115`)

## Critical issues
- None

## Important issues
- None

## Minor issues
- **Terminal “done” chunk semantics on failure are ambiguous.** If `streamSpec(...)` throws, no `{ done: true }` chunk is emitted; if `writeSpec(...)` throws, the `{ done: true }` chunk has already been sent even though `ipc.invoke('spec:generate', ...)` will reject. For Phase 1 this is probably acceptable (caller can treat invoke rejection as terminal), but it’s a real UI-footgun if the renderer relies on chunk termination to clear state. (`src/main/ipc/spec.ts:104-113`)
- **Error clarity:** unsafe `issueId` values and genuinely-missing issues both throw the same message (`Issue not found in cache: <id>`). That’s fine for the plan/tests, but if this bubbles to UI it may be confusing (unsafe ID vs cache miss). (`src/main/ipc/spec.ts:51-58`, `tests/main/ipc-spec-generate.test.ts:167-193, 195-221`)
- **Event typing is intentionally minimal, but slightly under-specifies Electron.** The handler uses a custom `SpecGenerateEvent` shape rather than `Electron.IpcMainInvokeEvent`; this is structurally OK for current usage (only `sender.send(...)` is needed), but it can drift from real Electron types over time. (`src/main/ipc/spec.ts:18-25, 98-110`)
- **Runtime payload validation:** like `spec:get`, `spec:generate` assumes `{ issueId: string }` at runtime. A small guard (`typeof payload?.issueId === 'string'`) would make failures more explicit; today some non-string values may coerce in surprising ways (e.g. regex `.test` coercion). (`src/main/ipc/spec.ts:12-16, 98-103`)

## Drift detected
- Repeated IPC test-double scaffolding appears again (new `IpcMainLike`/handler types in this test suite), consistent with the already-logged Phase 1 tech debt entry from Task 26. This is not silent drift, but per the tech-debt trigger (“when the next IPC test suite is added”), Task 27 is the moment to consider extracting a shared helper. (`tests/main/ipc-spec-generate.test.ts:14-26`, `tests/main/ipc-spec-get.test.ts:11-14`, `thoughts/tech-debt.md:57`)

## Assessment
Task 27’s implementation matches the Phase 1 streaming IPC contract, keeps complexity low, and is well-covered by focused tests (including safe-id rejection). The remaining concerns are mostly edge-case semantics (how/when to emit a terminal chunk on error) and minor clarity/typing nits rather than correctness problems for the MVP.

