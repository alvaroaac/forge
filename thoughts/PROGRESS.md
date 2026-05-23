# Progress log — Forge

Top-level progress log for project-level work. Sub-tasks tracked in `thoughts/tasks/<slug>/PROGRESS.md`.

---

## 2026-05-22 — Comment-context pipeline implemented

### Tried that worked

- Executed the approved v2 comment-context pipeline plan in a new worktree on `codex-comment-context-pipeline`.
- Added paginated Linear comment fetching, cached Linear UUID preservation on `Issue`, bot filtering/normalisation, and a pinned Haiku 4.5 comment triager.
- Wired curated comment context into both spec and triage generation, with `spec:phase` / `triage:phase` events for `triaging` and `generating`.
- Added preload subscribers, renderer hook phase state, and drawer phase indicators for both spec and triage flows.
- Subagent review caught and fixed two issues during implementation: paginating beyond the first 250 comments, and avoiding `phase: 'done'` after rejected hook-level generation calls.
- Final verification passed: `npm test` (61 files / 374 tests), `npm run typecheck`, and `npm run lint`.

### Decisions

- `fetchIssueComments` now truly paginates all comments despite the original plan showing a single `comments(first: 250)` query, because the public contract says every/all comments.
- The `ForgeApi` `onPhase` methods are required, not optional; test stubs were updated to match the shared API contract.
- Task 13 production wiring was pulled partly into Tasks 11/12 to satisfy typecheck after handler dependencies became required; Task 13 then added the missing register wiring test.

## Current state

Comment-context pipeline is implemented and locally verified in `.worktrees/comment-context-pipeline` on branch `codex-comment-context-pipeline`. Main worktree remains untouched and unpushed. Visual Electron UI verification is still deferred to a local desktop run; see `thoughts/tech-debt.md`.
