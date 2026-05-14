# Task 2 QA Review — Generate Specs Through Logged-In Claude CLI

## Strengths

- Spec generation now runs through the Claude CLI with `claude -p`, argument arrays, `shell: false`, and no `--bare`, so it can use the user's normal logged-in Claude Code auth.
- The selected model flows into generation explicitly: the renderer can pass a model override to `spec:generate`, and main falls back to `cfg.claudeModel` when no override is provided.
- Runtime Anthropic SDK construction is gone from main registration.
- Done and error events now cross main, preload, shared API, hook, drawer, and tab layers.
- CLI errors remain visible even after partial streamed output, so a failed generation cannot masquerade as a successful partial spec.
- TypeScript spawn typing now matches the actual stdio tuple.

## Issues

### Critical

- None.

### Important

- None.

### Minor

- None.

## Drift Detected

- None. The changes stayed within spec generation, shared IPC typing, preload exposure, and renderer consumption.

## Assessment

✅ QA approved.

Verification included:

- `npm run typecheck`
- `./node_modules/.bin/vitest run tests/main/ipc-spec-generate.test.ts tests/main/preload.test.ts tests/renderer/spec-tab.test.tsx tests/renderer/spec-drawer.test.tsx tests/renderer/use-spec-stream.test.ts tests/renderer/app.test.tsx tests/main/auth-checker.test.ts tests/main/ipc-auth.test.ts tests/main/linear-skill-checkAuth.test.ts tests/main/linear-skill-fetchIssueDetail.test.ts tests/main/linear-service.test.ts tests/main/ipc-linear.test.ts tests/shared/ipc-channels.test.ts`
