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

## 2026-06-03 — Generation-done notifications shipped

### Tried that worked

- Added a desktop notification when spec or triage generation completes (`feat: notify when generation completes`, commit `dde55d8`).
- Wired `src/main/ipc/spec.ts` and `src/main/ipc/triage.ts` through `src/main/services/notifications.ts`, with coverage for both generation paths.
- Shipped the feature as PR #5 after the comment-context pipeline merged as PR #4.
- Added a same-day follow-up (`fix: make notifications best effort`, commit `16af363`) so notification failures cannot fail otherwise-successful generation.

### Decisions

- Completion notifications are best-effort side effects: generation success does not depend on the operating system accepting or displaying a notification.

## 2026-09-02 — Resumed after hiatus

### Tried that worked

- Reassessed the repository after the project hiatus and identified the active initiatives and refactor work.
- Confirmed `thoughts/tasks/embed-plan-review/initial-spec.md` is the one open initiative: Draft v3 is at the human-approval gate, with an adversarial review in progress.
- Started drafting a new initiative spec under `thoughts/tasks/pr-review-surface/`.
- Resumed the triage-to-brief rename, originally logged in `thoughts/tech-debt.md` on 2026-06-02, on branch `refactor/triage-to-brief`.

### Decisions

- Keep the embed-plan-review initiative at the human-approval gate while its adversarial review is in progress.
- Treat the pr-review surface as a separate initiative and continue its spec before implementation.
- Complete the triage-to-brief terminology migration on its dedicated refactor branch.

## Current state

Forge has resumed after a hiatus. The one open initiative, `thoughts/tasks/embed-plan-review/initial-spec.md`, is at Draft v3 and remains at the human-approval gate while an adversarial review is in progress. A separate initiative spec is being drafted under `thoughts/tasks/pr-review-surface/`. The triage-to-brief rename is in progress on branch `refactor/triage-to-brief`.
