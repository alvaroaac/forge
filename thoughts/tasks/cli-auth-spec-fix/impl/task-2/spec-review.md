# Task 2 Spec Review

✅ Spec compliant.

Evidence checked after QA fixups:

- Claude CLI invocation is argument-array based: `src/main/services/spec-generator.ts:17` builds `['-p', '--model', input.model, '--append-system-prompt', input.system, input.user]`, with no `--bare`.
- Generation avoids shell interpolation: `src/main/services/spec-generator.ts:32` calls `spawnProcess('claude', buildClaudeArgs(input), { shell: false, stdio: ['ignore', 'pipe', 'pipe'] })`.
- Runtime streaming is preserved: `src/main/services/spec-generator.ts:41` listens for stdout chunks, appends them to final content at `src/main/services/spec-generator.ts:44`, and forwards each chunk through `onChunk` at `src/main/services/spec-generator.ts:45`.
- CLI failures are legible: `src/main/services/spec-generator.ts:21` formats nonzero exits with the exit code and stderr when available, and `src/main/services/spec-generator.ts:61` rejects with that error.
- Spec generation IPC uses the configured model and injected CLI-backed generator: `src/main/ipc/spec.ts:102` calls `deps.streamSpec` with `model: cfg.claudeModel` at `src/main/ipc/spec.ts:103`.
- Persistence stays on the required path: `src/main/ipc/spec.ts:108` calls `writeSpec({ repoPath, issueId, content })`, while `src/main/services/spec-writer.ts:9` writes under `thoughts/tasks/<issue-id>` and `src/main/services/spec-writer.ts:11` writes `initial-spec.md`.
- Done signaling happens after persistence: `src/main/ipc/spec.ts:108` awaits `writeSpec`, then `src/main/ipc/spec.ts:109` emits the final `SpecStreamChunk`, and `src/main/ipc/spec.ts:110` emits `SpecGenerateDone`.
- Error signaling is emitted on failure: `src/main/ipc/spec.ts:112` catches errors, `src/main/ipc/spec.ts:113` normalizes the message, and `src/main/ipc/spec.ts:114` emits `SpecGenerateError`.
- The Electron main registration path no longer constructs an Anthropic SDK client: `src/main/ipc/register.ts:12` imports `streamSpec`, and `src/main/ipc/register.ts:69` wires it into `registerSpecGenerateHandler`. A repo search found no `new Anthropic()` or `Anthropic` runtime import in `src/`.
- Done/error channels now cross the shared/preload boundary: `src/shared/ipc-channels.ts:7` and `src/shared/ipc-channels.ts:8` define the channels, `src/shared/types.ts:48` and `src/shared/types.ts:52` define the payloads, `src/shared/forge-api.ts:23` and `src/shared/forge-api.ts:24` expose listeners, and `src/main/preload.ts:26` plus `src/main/preload.ts:29` subscribe via `ipcRenderer`.
- Renderer propagation is now covered: `src/renderer/hooks/use-spec-stream.ts:157` subscribes to done events, `src/renderer/hooks/use-spec-stream.ts:160` subscribes to error events, `src/renderer/hooks/use-spec-stream.ts:122` stores the error message, `src/renderer/App.tsx:34` receives `errorMessage`, `src/renderer/App.tsx:90` passes it into the drawer, `src/renderer/components/spec-drawer.tsx:108` passes it into the spec tab, and `src/renderer/components/spec-tab.tsx:34` renders it when the spec is still empty.

Test evidence:

- `tests/main/spec-generator.test.ts:39` proves Claude is invoked with an argument array, stdout chunks are forwarded, and final content is returned.
- `tests/main/spec-generator.test.ts:65` proves nonzero CLI exits reject with stderr included in the message.
- `tests/main/ipc-spec-generate.test.ts:98` proves IPC chunk forwarding, prompt/model wiring, and final persistence wiring.
- `tests/main/ipc-spec-generate.test.ts:205` proves done signaling happens only after persistence succeeds.
- `tests/shared/ipc-channels.test.ts:11` and `tests/shared/ipc-channels.test.ts:12` guard the new done/error channel constants.
- `tests/main/preload.test.ts:37` and `tests/main/preload.test.ts:41` cover the shared `ForgeApi` done/error listener surface.
- `tests/renderer/use-spec-stream.test.ts:296` proves preload-delivered generation errors stop streaming and surface the CLI error message in renderer state.
- `tests/renderer/spec-tab.test.tsx:120` proves the visible empty-state error rendering.

Verification run:

- `./node_modules/.bin/vitest run tests/main/spec-generator.test.ts tests/main/ipc-spec-generate.test.ts tests/main/preload.test.ts tests/shared/ipc-channels.test.ts tests/renderer/use-spec-stream.test.ts tests/renderer/spec-tab.test.tsx tests/renderer/spec-drawer.test.tsx`
- Result: 7 files passed, 30 tests passed.

Tech-debt accounting:

- No Task 2 requirement appears intentionally skipped.
- No new Task 2 tech-debt entry is needed in `thoughts/tech-debt.md`.
