## Status: DONE

## What I implemented
- Added `fetchTeamTriage()` to `.agents/skills/linear/reference/linear.mjs` (immediately above the return block), including the GraphQL query scoped to:
  - team key (`team: { key: { eq: $teamKey } }`)
  - triage state (`state: { type: { eq: "triage" } }`)
  - returned fields including `assignee { id }`
- Exported `fetchTeamTriage` in the returned client object.
- Updated `.agents/skills/linear/SKILL.md` under **Reads** after `fetchAssignedIssues` with the new operation contract and note about `assignee` for filtering.
- Added `tests/main/linear-skill-fetchTeamTriage.test.ts` following the project test pattern:
  - stubs global `fetch`
  - sets `process.env.LINEAR_API_KEY = 'test-key'`
  - creates client via `createLinearClient({ teamKey: 'FUL', titlePrefix: '' })`
  - calls `fetchTeamTriage()`
  - asserts assignee preservation (`null` and `{ id: 'u42' }`)
  - asserts request variables and query strings include triage filter and team key.

## What I tested and results
- `npm test -- tests/main/linear-skill-fetchTeamTriage.test.ts`
  - Initial run (before implementation): failed with `fetchTeamTriage is not a function`.
  - Re-run (after implementation): passed.

## Files changed
- `.agents/skills/linear/reference/linear.mjs`
- `.agents/skills/linear/SKILL.md`
- `tests/main/linear-skill-fetchTeamTriage.test.ts`
- `thoughts/tasks/add-triage/impl/task-4/progress.md`

## Commit SHA(s)
- `84ad2f8`

## Self-review findings
- Confirmed the test is aligned with the requested shape and query requirements.
- Function placement and export are consistent with existing client method style.
- No unrelated functional modules were modified.

## Tech-debt logged
- None.

## Any issues or concerns
- None.
