# Forge

Personal desktop engineering command center. Electron + React app that pulls assigned Linear issues, generates structured spec reports via the Claude API, and (post Phase 1) spawns Claude Code or Codex CLI agents from the UI.

## Status

Phase 1 MVP — see [`thoughts/tasks/phase1-mvp/plans/2026-05-12-phase1-mvp.md`](thoughts/tasks/phase1-mvp/plans/2026-05-12-phase1-mvp.md) for the implementation plan.

## Requirements

- Node 22+ (see `.nvmrc`)
- macOS or Linux
- Linear access token at `~/.humanlayer/riptide/linear.json` (`{ "access_token": "..." }`)
- Claude Code and Codex CLI installed and authenticated (Phase 2 spawning; not required for Phase 1)

## Develop

```bash
npm install
npm run dev          # electron-vite dev server
npm run typecheck    # tsc --noEmit (main + renderer)
npm run lint         # eslint
npm run test         # vitest
npm run e2e          # playwright (electron smoke)
```

## Repo layout

- `src/main/` — Electron main process (Node)
- `src/renderer/` — React UI (no `node:*` imports)
- `src/shared/` — types + IPC channel constants (main + renderer safe)
- `.agents/skills/` — agent-facing skills (Linear client, subagent-driven-development)
- `thoughts/` — agent handshake protocol (conventions, tasks, plans, reviews)
- `docs/superpowers/` — specs and design references

## Agent conventions

See [`AGENTS.md`](AGENTS.md) and [`thoughts/conventions.md`](thoughts/conventions.md) before contributing.

## License

MIT — see [`LICENSE`](LICENSE).
