✅ Spec compliant

Verified on current files and commands:
- `.agents/skills/linear/reference/linear.mjs:452-462` defines documented async `getCurrentUser()` with `query { viewer { id name email } }` and returns `data.viewer`.
- `.agents/skills/linear/reference/linear.mjs:465-482` includes `getCurrentUser` in the returned client object.
- `tests/main/linear-skill-getCurrentUser.test.ts:3-13` uses a local typed dynamic-import helper; no `ts-ignore` or `ts-expect-error` remains.
- `tests/main/linear-skill-getCurrentUser.test.ts:19-34` stubs global `fetch`, sets `process.env.LINEAR_API_KEY = 'test-key'` in `beforeEach`, dynamically imports `../../.agents/skills/linear/reference/linear.mjs`, constructs `createLinearClient({ teamKey: 'FUL', titlePrefix: '' })`, asserts `client.getCurrentUser()` returns `{ id: 'u1', name: 'Al', email: 'a@b' }`, and checks the request query matches `/viewer/`.
- `git show --stat 40d1d5b` confirms the follow-up change is limited to the task test and progress report; `.agents/skills/linear/reference/linear.mjs` remains owned by Task 4 and in scope under the stated exception.
- `thoughts/tech-debt.md:50-56` has no Task 4 shortcut entry, which is correct after removal of the prior typing escape hatch.

Verified commands now:
- `npx vitest run tests/main/linear-skill-getCurrentUser.test.ts` — passed.
- `npm run test` — passed.
- `npm run typecheck` — passed.
- `npm run lint` — passed.
- `npm run format:check` — passed.
