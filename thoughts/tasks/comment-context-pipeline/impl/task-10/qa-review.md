# Task 10 QA Review - Preload `onPhase` subscribers

## Strengths

- The final API shape matches the plan after the follow-up fix. `ForgeApi.spec.onPhase` and `ForgeApi.triage.onPhase` are required function properties in `src/shared/forge-api.ts`, with handlers typed as `SpecPhaseEvent` and `TriagePhaseEvent`.
- The preload implementation is narrow and uses the existing subscriber helper instead of introducing a second listener pattern: `spec.onPhase` subscribes to `IpcChannel.SpecPhase`, and `triage.onPhase` subscribes to `IpcChannel.TriagePhase`.
- The unsubscribe behavior remains consistent with the existing bridge contract. Both phase subscribers return the `subscribe(...)` cleanup function, which calls `ipcRenderer.off(channel, listener)` with the same listener registered through `ipcRenderer.on`.
- The preload tests are meaningful for this task's boundary. They assert that each new API member is exposed, registers the expected channel, returns a function, and unregisters the captured listener from the same phase channel.
- The original drift in commit `a7c3e51`, where `onPhase` was made optional to avoid renderer fixture updates, was corrected in `3abc443`. The fixture updates now preserve the required shared contract instead of weakening production types.
- Renderer fixture churn is mechanical and contract-driven. The added `onPhase: vi.fn(() => vi.fn())` stubs only satisfy the required `ForgeApi` shape and do not change test assertions or production behavior.
- No production behavior was weakened. The combined Task 10 production diff only imports event types, extends `ForgeApi`, and exposes the two preload subscribers.

## Issues

### Critical

None.

### Important

None.

### Minor

None.

## Drift detected

No repeated drift pattern detected in the final Task 10 state. The temporary optional-API drift from `a7c3e51` was fixed by `3abc443`, and the final shape aligns with Task 9's required phase event types and channel constants.

One review-process note: `thoughts/tasks/comment-context-pipeline/impl/task-6/qa-review.md` is absent in this worktree, so the prior-QA comparison used Tasks 1-5 and 7-9 QA files plus Task 6 progress/spec-review artifacts.

## Assessment

Approved. Task 10 now exposes required phase subscribers through the correct preload channels, keeps the unsubscribe pattern consistent, updates renderer stubs without weakening the API contract, and avoids fixture or production churn beyond what the required contract needs.

Verification run:
- `npm test -- tests/main/preload.test.ts tests/renderer/app.test.tsx tests/renderer/triage-drawer.test.tsx tests/renderer/use-auth-status.test.ts tests/renderer/use-issues.test.ts tests/renderer/use-spec-stream.test.ts tests/renderer/use-triage-stream.test.ts` - passed, 7 files / 64 tests.
- `npm run typecheck` - passed.
