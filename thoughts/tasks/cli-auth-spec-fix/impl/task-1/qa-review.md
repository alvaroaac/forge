# Task 1 QA Review — Make Auth Status Truthful

## Strengths

- Auth status is now honest at the behavior boundary: Claude and Codex use login/status commands, while Linear delegates health to the canonical `.agents/skills/linear` client.
- The Linear health path is non-fatal and covers missing auth, request failures, GraphQL errors, HTTP failures, and missing viewer ids.
- Renderer and shared API shape stay unchanged for `AuthStatus`, so the navbar can keep reading booleans while their meaning is now "usable now."
- Tests cover the old false-positive CLI checks and the Linear skill health behavior.

## Issues

### Critical

- None.

### Important

- None.

### Minor

- None.

## Drift Detected

- None remaining. The earlier duplicate Linear GraphQL/auth path in `auth-checker.ts` was removed and replaced with the canonical Linear skill client path.

## Assessment

✅ QA approved.

Verification included:

- `pnpm exec vitest run tests/main/auth-checker.test.ts tests/main/ipc-auth.test.ts tests/main/linear-skill-checkAuth.test.ts`
- Wider regression later passed with the current code state.
