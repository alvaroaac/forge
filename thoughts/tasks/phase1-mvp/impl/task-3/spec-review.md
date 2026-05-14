✅ Spec compliant

Verified against actual files:
- [src/shared/ipc-channels.ts](/Users/alvarocarvalho/desenv/personal/forge/src/shared/ipc-channels.ts:1) exports `IpcChannel` with the required keys/values and `as const`, plus `IpcChannelName = (typeof IpcChannel)[keyof typeof IpcChannel]` at line 12.
- [tests/shared/ipc-channels.test.ts](/Users/alvarocarvalho/desenv/personal/forge/tests/shared/ipc-channels.test.ts:1) imports `IpcChannel` from `../../src/shared/ipc-channels` and asserts all eight required channel values at lines 6-13.

Verified commands:
- `npx vitest run tests/shared/ipc-channels.test.ts` — passes in the repo.
- `npm run test` — passes.
- `npm run typecheck` — passes.
- `npm run lint` — passes.
- `npm run format:check` — passes.

Verified TDD/failing-first behavior:
- Commit [`37d7cda`]( /Users/alvarocarvalho/desenv/personal/forge/.git) has the required message: `feat(shared): IPC channel constants`.
- The task commit adds both the test and implementation files, so history alone does not preserve the failing-first step.
- To verify the requested failure mode directly, I ran `npx vitest run tests/shared/ipc-channels.test.ts` in a disposable copy with `src/shared/ipc-channels.ts` removed; Vitest failed with missing module resolution for `../../src/shared/ipc-channels`, matching the requirement.

Tech-debt accounting:
- No Task 3 entry exists in [thoughts/tech-debt.md](/Users/alvarocarvalho/desenv/personal/forge/thoughts/tech-debt.md), and no intentionally deferred work was evidenced in the implementation, so no missing tech-debt log was found.
