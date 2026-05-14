# Task 1 Spec Review — Make Auth Status Truthful

✅ Spec compliant

## Findings

No spec compliance issues found.

## Evidence Reviewed

- Claude and Codex status now use logged-in usability commands, not version probes: `src/main/services/auth-checker.ts:29`, `src/main/services/auth-checker.ts:31`, `src/main/services/auth-checker.ts:32`.
- CLI failures remain non-fatal and return `false`: `src/main/services/auth-checker.ts:8`, `src/main/services/auth-checker.ts:12`.
- Linear auth status delegates to an injected Linear skill client and converts thrown failures to `false`: `src/main/services/auth-checker.ts:4`, `src/main/services/auth-checker.ts:17`, `src/main/services/auth-checker.ts:20`.
- Auth IPC passes the configured token path and canonical Linear client into `checkAll`, preserving the renderer-facing `AuthStatus` shape: `src/main/ipc/auth.ts:12`, `src/main/ipc/auth.ts:18`, `src/main/ipc/auth.ts:20`.
- Main registration loads `.agents/skills/linear/reference/linear.mjs`, creates the client from configured team data, and reuses it for auth and Linear issue reads: `src/main/ipc/register.ts:35`, `src/main/ipc/register.ts:39`, `src/main/ipc/register.ts:57`, `src/main/ipc/register.ts:58`, `src/main/ipc/register.ts:62`.
- The canonical Linear skill client now documents non-fatal health checks: `.agents/skills/linear/SKILL.md:13`, `.agents/skills/linear/SKILL.md:39`.
- The canonical Linear skill client reads `LINEAR_API_KEY` first, then the configured OAuth token file, and uses a `viewer { id }` GraphQL request for health: `.agents/skills/linear/reference/linear.mjs:17`, `.agents/skills/linear/reference/linear.mjs:18`, `.agents/skills/linear/reference/linear.mjs:22`, `.agents/skills/linear/reference/linear.mjs:487`, `.agents/skills/linear/reference/linear.mjs:492`.
- Linear HTTP errors, GraphQL errors, missing auth, thrown request failures, and missing viewer ids all resolve to `false` for health-check callers: `.agents/skills/linear/reference/linear.mjs:59`, `.agents/skills/linear/reference/linear.mjs:64`, `.agents/skills/linear/reference/linear.mjs:488`, `.agents/skills/linear/reference/linear.mjs:489`, `.agents/skills/linear/reference/linear.mjs:497`, `.agents/skills/linear/reference/linear.mjs:498`.
- Tests pin the new CLI commands and reject `claude --version` / `codex --version` false positives: `tests/main/auth-checker.test.ts:56`, `tests/main/auth-checker.test.ts:65`, `tests/main/auth-checker.test.ts:67`.
- Tests pin Linear delegation through the skill client and non-fatal rejection handling: `tests/main/auth-checker.test.ts:39`, `tests/main/auth-checker.test.ts:46`, `tests/main/auth-checker.test.ts:72`.
- Tests pin `checkAuth` success only after a viewer id, `LINEAR_API_KEY` precedence, and false results for missing auth, HTTP failure, GraphQL error, and missing viewer id: `tests/main/linear-skill-checkAuth.test.ts:31`, `tests/main/linear-skill-checkAuth.test.ts:47`, `tests/main/linear-skill-checkAuth.test.ts:61`.

## Verification

- `pnpm exec vitest run tests/main/auth-checker.test.ts tests/main/ipc-auth.test.ts tests/main/linear-skill-checkAuth.test.ts`
- Result: 3 files passed, 12 tests passed.

## Tech-Debt Accounting

No intentionally skipped Task 1 requirement found. No new `thoughts/tech-debt.md` entry is required.
