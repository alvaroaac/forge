# Task 20 QA Review (Phase 1 MVP): Spec prompt builder

✅ Approved

## Strengths

- Prompt builder is deterministic, pure, and side-effect free: `buildSpecPrompt(...)` is straight string construction (no I/O, no API calls, no time/random dependencies). See `src/main/services/spec-prompt.ts`.
- Complexity and readability are comfortably within the repo constraint (max cyclomatic complexity <= 4). `renderThoughts(...)` is a single `map/join`, and `buildSpecPrompt(...)` is straight-line assembly.
- Types are explicit and narrow: the function accepts `{ issue: Issue; context: RepoContext; templateMd: string }` and returns `{ system: string; user: string }` without `any`.
- Context injection is complete for the intended contract: user content includes `AGENTS.md`, top-level `thoughts/` rendered content, issue `id/title/description/priority/labels`, and the provided template.
- Test is meaningful and low-brittleness: it asserts the presence of required context tokens without snapshotting or over-specifying formatting (`toContain(...)` checks), so small formatting tweaks won’t cause noisy failures.
- Verification is green in the current tree:
  - `npx vitest run tests/main/spec-prompt.test.ts`: PASS
  - `npm run test`: PASS
  - `npm run lint`: PASS (0 errors, 1 warning)
  - `npm run typecheck`: PASS
  - `npm run format:check`: PASS
- Progress report is materially accurate vs current commit `0c242a1` (files changed and command outcomes match), and the addendum tooling-scope rule is respected (no opportunistic rewrites outside owned app/test files + the task artifact).

## Issues

### Critical

- None.

### Important

- None.

### Minor

- Repo-wide drift baseline persists (not introduced by Task 20): `npm run lint` continues to emit the pre-existing warning in `tests/main/paths.test.ts` (`vi` unused). This is repeatedly noted in prior QA reviews (Tasks 10–19) and still shows up in Task 20’s verification runs.
- Slight coverage gap vs the stated intent in the progress report: the test asserts id/title/description/template/context tokens, but it does not explicitly lock in that `priority` and `labels` are present in the built user prompt. The implementation includes them today, so this is not a functional issue, but it makes a future regression on those two fields less likely to be caught.

## Drift detected

- Repeated pattern from Tasks 10–19: a single non-fatal ESLint warning remains in `tests/main/paths.test.ts` and continues to appear in “commands should pass” verification. Task 20 does not worsen it.
- Previously-noted drift outside this task’s scope also remains unchanged: `.agents/skills/linear/reference/linear.mjs` JSDoc still overpromises `issueType` for `fetchAssignedIssues` relative to its selection set (raised repeatedly in Tasks 5–9 QA history).

## Assessment

Task 20 meets the code-quality bar: the prompt builder is simple/typed/deterministic with no side effects, the test is meaningful without being overly brittle, the progress report matches the repo state, and the required command set passes on the current working tree. ✅
