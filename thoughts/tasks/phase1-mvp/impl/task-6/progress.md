Status: DONE

What you implemented
Documented the new linear read helpers in `.agents/skills/linear/SKILL.md`:
- Added `getCurrentUser()` to the Reads list after `findIssues()`.
- Added `fetchAssignedIssues(assigneeId)` to the Reads list after `getCurrentUser()`.

What you tested and test results
- Verified the edited section in `.agents/skills/linear/SKILL.md` contains the two new bullets in the requested format and position.
- Did not run `npm run format:check`, `npm run lint`, or `npm run typecheck` because the change is documentation-only in `.agents/` and does not affect code formatting/lint/typecheck inputs.

Files changed
- `.agents/skills/linear/SKILL.md`
- `thoughts/tasks/phase1-mvp/impl/task-6/progress.md`

Self-review findings
- Scope is intentionally limited to requested documentation updates only.
- New lines mirror task-specified text exactly and keep the existing list ordering.

Tech-debt logged
- None.

Commits made
- `37d83f7` (`docs(linear): document getCurrentUser + fetchAssignedIssues`)

Concerns
- None.

Model Choice Audit
- Implementer model: `gpt-5.3-codex-spark`
