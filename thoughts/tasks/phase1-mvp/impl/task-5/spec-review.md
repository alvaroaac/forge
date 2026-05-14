✅ Spec compliant (Task 5 re-review, 2026-05-13)

Addendum enforcement (read-only dirs): OK. Task 5 explicitly owns `.agents/skills/linear/reference/linear.mjs`, and the only non-source edits are confined to `thoughts/tasks/phase1-mvp/impl/task-5/progress.md` + this review.

**Required checks**

- ✅ `.agents/skills/linear/reference/linear.mjs` defines and returns `fetchAssignedIssues(assigneeId)`:
  - Definition: `.agents/skills/linear/reference/linear.mjs:478-500`.
  - Exported from the returned client object: `.agents/skills/linear/reference/linear.mjs:502-520`.
- ✅ Query matches requirements:
  - Filters assignee id + team key: `.agents/skills/linear/reference/linear.mjs:483-486`.
  - Excludes `completed`/`canceled` server-side: `.agents/skills/linear/reference/linear.mjs:486`.
  - Fetches `first: 250`: `.agents/skills/linear/reference/linear.mjs:482-488`.
  - Returns raw `nodes` with requested fields: `.agents/skills/linear/reference/linear.mjs:489-495` and returns `data.issues.nodes` at `.agents/skills/linear/reference/linear.mjs:499-500`.
- ✅ Test matches Task 5 requirements and uses no `ts-ignore` / `@ts-expect-error` shortcuts:
  - Test behavior and assertions match the plan’s Task 5 snippet (including variable assertion): `tests/main/linear-skill-fetchAssigned.test.ts:1-70`.
  - No `ts-ignore` / `@ts-expect-error` present in the file (confirmed by grep).
- ✅ Progress report includes concrete pre-implementation failing evidence (not hypothetical):
  - RED-step evidence includes the specific runtime failure (`type: undefined`, then `TypeError: client.fetchAssignedIssues is not a function`): `thoughts/tasks/phase1-mvp/impl/task-5/progress.md:15-21`.
- ✅ Tests + full checks pass locally (rerun by reviewer on current tree):
  - `npx vitest run tests/main/linear-skill-fetchAssigned.test.ts`
  - `npm run test`
  - `npm run typecheck`
  - `npm run lint`
  - `npm run format:check`
