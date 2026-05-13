# Forge — Agent Context

## What this is

Forge is a personal desktop engineering command center. Electron + React app that pulls assigned Linear issues, generates structured spec reports via Claude API, and spawns Claude Code or Codex CLI agents directly from the UI.

## Stack

- **Shell:** Electron
- **Renderer:** React + TypeScript
- **Main process:** Node.js
- **Styling:** TBD (dark theme, command center aesthetic)
- **Storage:** SQLite or flat JSON (local-first, no backend)
- **Agent spawning:** node-pty + xterm.js
- **External APIs:** Linear GraphQL API, Claude API

## Principles

- **Local-first.** No backend. Linear is source of truth.
- **Config-driven.** No hardcoded paths, team IDs, or assumptions. Everything configurable.
- **Sellable-aware.** Built from day one as if it will be distributed to other engineers.
- **thoughts/ is the agent handshake protocol.** Every spawned agent reads `thoughts/` on init for context. Do not skip this.

## thoughts/ convention

`thoughts/` is the shared memory layer between the user and all agents. It is the single source of truth for everything an agent needs in order to start work on a task — initial spec, implementation plans, addendums, per-task progress, and per-task review artifacts.

```
thoughts/
├── initial-thoughts.md           project origin and phased plan
├── tech-debt.md                  deferred-on-purpose work log (skipped for complexity/scope/YAGNI)
├── conventions.md                rules every agent must follow
└── tasks/
    └── <task-slug>/              Linear issue id (e.g. FUL-42) OR free-form slug for project-level work (e.g. phase1-mvp)
        ├── initial-spec.md       generated spec (Linear-issue tasks only)
        ├── plans/
        │   ├── <plan-slug>.md           implementation plan (from superpowers:writing-plans)
        │   └── <plan-slug>.addendum.md  optional: project-specific drift corrections, invariants, per-plan rules
        └── impl/                  execution artifacts (from subagent-driven-development)
            ├── final-review.md           plan-end review (after all per-task reviews pass)
            └── task-<N>/                 one folder per plan task
                ├── progress.md           implementer's report: what was built, files, tests, commits, tech-debt logged
                ├── spec-review.md        stage-1 review: spec compliance, addendum-rule check, tech-debt-accounting check
                └── qa-review.md          stage-2 review: code quality, drift call-outs vs prior tasks
```

**On every spawn:** read `thoughts/conventions.md` before doing anything else. Read the relevant `thoughts/tasks/<task-slug>/` folder if working on a specific task.

**Slug rules:**
- For Linear-tracked work: slug = Linear issue id (e.g. `FUL-42`).
- For project-level work that is not tracked in Linear (phase plans, internal refactors, etc.): slug = free-form kebab-case name (e.g. `phase1-mvp`).
- Never mix the two schemes inside one folder.

## Spec format

Specs live at `thoughts/tasks/<task-slug>/initial-spec.md`. Template at `docs/templates/spec-template.md`.

Sections: Task Summary / Context / Suggested Approach / Open Questions.

A spec must be explicitly approved by the user before any agent begins implementation work.

## Project skills

Reusable agent utilities live in `.agents/skills/`. Each skill has a `SKILL.md` documenting its API and a `reference/` folder with the implementation.

```
.agents/skills/
└── linear/
    ├── SKILL.md              Linear CRUD client — read this before any Linear operation
    └── reference/
        └── linear.mjs        createLinearClient factory
```

**Before any Linear operation**, read `.agents/skills/linear/SKILL.md`. Import the client from `.agents/skills/linear/reference/linear.mjs`. Do not hand-roll GraphQL mutations.

Do not duplicate skills under `.claude/skills/` — `.agents/` is the canonical location, tool-agnostic across Claude Code, Cursor, and Codex.

## Orchestrator reference

`scripts/orchestrator-core/` contains the Ralph Mode orchestration engine. Read it before working on Phase 4 (orchestration integration). Do not modify it directly — it is a reference implementation.

## Phases

- **Phase 1 (MVP):** Linear polling + issue list + spec generation. Tech spec: `docs/superpowers/specs/2026-05-12-phase1-tech-spec.md`. Implementation plan: `thoughts/tasks/phase1-mvp/plans/2026-05-12-phase1-mvp.md`.
- **Phase 2:** Agent launcher (node-pty + xterm.js), spec approval gate, Linear comment feedback.
- **Phase 3:** Background sync daemon, thoughts/tasks/ writer, thoughts/ scaffold on first run.
- **Phase 4:** Orchestrator integration (Ralph Mode), progress view.
- **Phase 5:** Config UI, onboarding, packaging, plugin system.

## Key constraints

- Auth for Linear, Claude Code, and Codex is handled manually by the user. No programmatic auth. On startup, verify CLI login state and surface errors — do not attempt to log in on the user's behalf.
- Spec must be marked approved before agent spawn. Enforce this gate.
- Agent output is streamed via node-pty into an xterm.js terminal pane — do not buffer or swallow stdout.

## Imported Claude Cowork project instructions

The goal is to build a personal desktop engineering command center that connects Linear, Claude Code, and Codex CLI into a unified workflow for spec generation, issue management, and agent orchestration.
