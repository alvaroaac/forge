# Task 1 Spec Review — Linear client `fetchIssueComments`

## Verdict

✅ Spec compliant

## Findings

- `.agents/skills/linear/reference/linear.mjs:604` defines `fetchIssueComments(issueId)`, and `.agents/skills/linear/reference/linear.mjs:661` exports it from `createLinearClient`.
- `.agents/skills/linear/reference/linear.mjs:609` paginates until `pageInfo.hasNextPage` is false, accumulating all pages into a single returned array at `.agents/skills/linear/reference/linear.mjs:637`.
- `.agents/skills/linear/reference/linear.mjs:615` uses the Linear issue UUID variable via `issue(id: $issueId)`. `.agents/skills/linear/reference/linear.mjs:617` keeps the requested `comments(first: 250)` page size and adds `after` only when continuing pagination.
- `.agents/skills/linear/reference/linear.mjs:618` selects pagination metadata required to satisfy the "every comment" contract. Comment node fields remain scoped to `id`, `body`, `createdAt`, `user { id name }`, and `botActor { id }` at `.agents/skills/linear/reference/linear.mjs:619`.
- `.agents/skills/linear/reference/linear.mjs:631` through `.agents/skills/linear/reference/linear.mjs:634` still returns `[]` for missing issue/comments by treating absent pages/nodes as empty and stopping pagination.
- `tests/main/linear-skill-fetchIssueComments.test.ts:32` covers the original normalized comment shape, UUID variable, `comments(first: 250)`, and lean `botActor { id }` selection. `tests/main/linear-skill-fetchIssueComments.test.ts:93` covers multi-page fetching and verifies the second request uses the cursor. `tests/main/linear-skill-fetchIssueComments.test.ts:154` and `tests/main/linear-skill-fetchIssueComments.test.ts:164` cover missing issue and absent comments.
- `.agents/skills/linear/SKILL.md:39` documents `fetchIssueComments(issueId)` as returning every comment on the issue, using the Linear UUID, with `botActor` limited to `{ id }`.
- Commit scope is clean for Task 1: `5a77616` added the client/docs/test, `ab058c8` added pagination/test coverage/progress, and `132302f` only updated the Task 1 progress report. No unrelated code work found.
- Tech-debt accounting is clean: `thoughts/tasks/comment-context-pipeline/impl/task-1/progress.md` reports no tech debt, and no new Task 1 shortcut entry was needed in `thoughts/tech-debt.md`.

## Verification

- `npm test -- tests/main/linear-skill-fetchIssueComments.test.ts` — passed, 1 file / 4 tests.
