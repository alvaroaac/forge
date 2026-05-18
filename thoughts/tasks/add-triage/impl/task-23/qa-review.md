# Task 23 QA Review

## Result

Pass after fixes.

## Must-check issues

- [x] `useIssues` no longer discards a successful assigned-issues refresh when `linear.fetchTeamTriage()` rejects. Added a regression test that covers the partial-failure path.
- [x] `npm run lint` exits cleanly. Fixed the empty `StreamClaudeInput` interface, removed the unnecessary hook dependency warning, and removed the unused `vi` import in `tests/main/paths.test.ts`.

## Verification

- `npm test -- tests/renderer/use-issues.test.ts` — passed: 1 file, 11 tests.
- `npm run lint` — passed.
- `npm run typecheck` — passed.
- `npm test` — passed: 55 files, 278 tests.

## Notes

- Computron-backed spec generation is expected behavior for this branch: specs should be generated against the target project repo, not Forge itself. The naming and config flow are confusing and should be cleaned up separately, but this is not a QA blocker.
- Worktree `.git` file handling for Computron health checks is intentionally ignored for this review pass.
