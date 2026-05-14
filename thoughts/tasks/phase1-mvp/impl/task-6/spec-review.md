# Task 6 — Spec Compliance Review (Stage 1)

Verdict: ✅

Reviewed inputs
- Conventions: `thoughts/conventions.md`
- Addendum rules: `thoughts/tasks/phase1-mvp/plans/2026-05-12-phase1-mvp.addendum.md`
- Task artifact: `thoughts/tasks/phase1-mvp/impl/task-6/progress.md`
- Git history: commit `37d83f7` (`docs(linear): document getCurrentUser + fetchAssignedIssues`)

Spec requirement: `.agents/skills/linear/SKILL.md` (Reads list)
Requirement: after the `findIssues()` line, insert exactly these two bullets:
- **`getCurrentUser()`** → `{ id, name, email }` — the authenticated viewer (per the OAuth token).
- **`fetchAssignedIssues(assigneeId)`** → `Array<{ id, identifier, title, description, state: { name, type }, priority, labels: { nodes: [{ name }] }, url, updatedAt }>` — open issues on the bound team assigned to `assigneeId`. Excludes `completed`/`canceled` states server-side.

Evidence (docs)
- Present in `.agents/skills/linear/SKILL.md` immediately after `findIssues()`: lines 34-36.

Evidence (git)
- Commit exists and matches requirement: `37d83f73aa3b62d9e874ad73b704d7280edb9d8d` with subject `docs(linear): document getCurrentUser + fetchAssignedIssues`.
- Diff in that commit adds exactly the two required bullets to `.agents/skills/linear/SKILL.md` directly after `findIssues()`.

Progress report verification
- `thoughts/tasks/phase1-mvp/impl/task-6/progress.md` reports commit `37d83f7` and the intended doc-only scope; matches git history and the observed file content.

Addendum compliance notes
- Addendum emphasizes not rewriting reference/protocol directories via tooling. This task’s change is a targeted documentation update in `.agents/` (explicitly owned by Task 6 per the request) and does not imply repo-wide formatting/lint rewrites.

