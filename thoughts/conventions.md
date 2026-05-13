# Agent Conventions

Read this before doing anything else. These rules apply to every agent working in this repo.

---

## thoughts/ protocol

- Read `thoughts/` on init, every time, no exceptions.
- If working on a specific task, read `thoughts/tasks/<task-slug>/` before touching code. Slug is a Linear issue id (e.g. `FUL-42`) for tracked work or a free-form kebab-case name (e.g. `phase1-mvp`) for project-level work.
- Plans live at `thoughts/tasks/<task-slug>/plans/<plan-slug>.md`. An optional `<plan-slug>.addendum.md` next to it carries project-specific overrides, drift corrections, and per-plan rules — read it if it exists.
- Per-task execution artifacts go under `thoughts/tasks/<task-slug>/impl/task-<N>/`:
  - `progress.md` — implementer's report (what was built, files, tests, commits, tech-debt logged).
  - `spec-review.md` — stage-1 review (spec compliance + addendum-rule check + tech-debt-accounting check).
  - `qa-review.md` — stage-2 review (code quality + drift call-outs vs prior tasks' `qa-review.md` files).
- `impl/final-review.md` is the plan-end review after all per-task reviews pass.
- Never delete files from `thoughts/`. Append or create new files.

## Spec gate

- A spec at `thoughts/tasks/<task-slug>/initial-spec.md` must exist and be marked approved before any implementation begins on a Linear-tracked task. Project-level work (e.g. `phase1-mvp`) is gated by an approved plan in `plans/`, not an `initial-spec.md`.
- If no approved spec/plan exists, stop and surface this to the user. Do not proceed.
- Spec format: `docs/templates/spec-template.md`.

## Code conventions

- TypeScript everywhere. No `any` without a `// reason:` comment on the same line.
- Electron main/renderer boundary is strict — no direct Node APIs in renderer. Use IPC.
- IPC channels are named `domain:action` (e.g. `linear:fetch-issues`, `agent:spawn`).
- Config is never hardcoded. All user-specific values come from the config store.

## TDD

Write tests before implementation. Every module has a corresponding test file. No feature is done until tests pass.

## Cyclomatic complexity

Maximum of 4 per function. Use early returns over nested conditionals. Decompose functions that would exceed this limit. No exceptions without an explicit comment.

## No duplication

Extract shared logic on the second occurrence, not the third. Shared utilities go in `src/shared/` (main + renderer safe) or `src/main/lib/` (main-only).

## Signaling completion

When done with a plan task (subagent-driven-development):
1. Write your implementer report to `thoughts/tasks/<task-slug>/impl/task-<N>/progress.md`. List files changed, tests run, commits made, self-review findings, and tech-debt logged.
2. Append every intentionally-skipped item to `thoughts/tech-debt.md` with the entry format:
   `- [YYYY-MM-DD][Task N] <description>. Reason: <complexity | deferred-phase | YAGNI | other>. Re-evaluate: <when/condition>.`
3. Stage-1 reviewer writes `spec-review.md` in the same folder; stage-2 reviewer writes `qa-review.md`. Do not move to the next task until both reviews are `✅`.

## What not to do

- Do not attempt to authenticate on behalf of the user (Linear, Claude Code, Codex).
- Do not spawn agents or processes outside of the Agent Runner IPC channel.
- Do not write to `thoughts/initial-thoughts.md` — it is a read-only origin document.
