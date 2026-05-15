# Spec: add-triage — Triage tab with computron-aware engineering brief

> **Status:** Draft
> **Generated:** 2026-05-14
> **Branch:** `add-triage` (off `plan-review-integration`)
> **Issue:** N/A (project-level work)

---

## Task Summary

Add a new **Triage** tab to the Forge issue list that surfaces Linear issues in the `triage` workflow-state. For these issues, replace the existing spec-generation flow with a different AI deliverable — an **engineering brief** — that helps a human reviewer decide what to do with the ticket. The brief is produced by spawning `claude` with read-only filesystem access to a separate, configurable repository called **computron**, so the model can ground its suggestions in real code rather than guess from the issue text alone.

Introduce a new configurable filesystem path (`computronRepoPath`) following the same pattern as the existing `linearTeamKey` / `repoPath` config fields.

---

## Context

### Where the feature lives today

- **Issue list:** `src/renderer/components/issue-list-panel.tsx` — four fixed tabs (`Todo`, `In Progress`, `In Review`, `Done`) driven by `Tab` union; tab-to-status map at top of file.
- **Issue type:** `src/shared/types.ts` — `IssueStatus = 'todo' | 'in_progress' | 'in_review' | 'done'`. No `triage` value yet.
- **Status mapping:** `src/main/services/linear-mapping.ts` — maps Linear `state.type` to `IssueStatus`.
- **Linear fetch:** `src/main/services/linear-service.ts` calls `client.fetchAssignedIssues(viewerId)`. The underlying query in `.agents/skills/linear/reference/linear.mjs:551` filters `state: { type: { nin: ["completed", "canceled"] } }` and scopes by assignee — triage issues are typically unassigned, so they never appear today.
- **Spec generation:** `src/main/services/spec-generator.ts` exposes `streamSpec({ model, system, user, onChunk })` which spawns `claude -p --model <m> --append-system-prompt <sys> --output-format text` and streams stdout deltas. `buildClaudeArgs` is hard-coded — no allowance for `--add-dir` or `--allowedTools`.
- **Spec drawer:** `src/renderer/components/spec-drawer.tsx` (UI) + `src/renderer/hooks/use-spec-stream.ts` (stream hook) + `src/main/ipc/spec.ts` (IPC) — the full chain we mirror for the triage brief.
- **Spec write:** `src/main/services/spec-writer.ts` persists spec markdown under `thoughts/tasks/<issueId>/initial-spec.md` on user action.
- **Repo context reader:** `src/main/services/repo-reader.ts` reads `AGENTS.md` + `thoughts/*.md` from the configured `repoPath`. We do **not** reuse this for computron — for computron the model itself does the reading via filesystem tools.
- **Config store:** `src/main/services/config-store.ts` — JSON file with `DEFAULTS` constant; merges user overrides over defaults.
- **Auth checks:** `src/main/services/auth-checker.ts` — startup verification for Linear / Claude Code / Codex.

### Conventions from `AGENTS.md`

- Local-first, no backend. Linear is source of truth.
- Config-driven — no hardcoded paths or team IDs.
- Sellable-aware — built for distribution from day one.
- All Linear writes/reads go through `.agents/skills/linear/reference/linear.mjs`. Extend the client there; do not hand-roll GraphQL.
- `thoughts/tasks/<task-slug>/` is the agent handshake folder. For non-Linear-tracked work the slug is free-form kebab-case (this task: `add-triage`).

### External dependencies

- `claude` CLI must accept `--add-dir <path>` and `--allowedTools "Read,Glob,Grep"` flags. **Verify exact flag syntax against installed `claude` version before implementation** — pin the verified syntax in the implementation plan.

---

## Suggested Approach

### 1. Extend `IssueStatus` and Linear mapping

- `src/shared/types.ts`: add `'triage'` to the `IssueStatus` union.
- `src/main/services/linear-mapping.ts`: extend `mapStatus` so `state.type === 'triage'` returns `'triage'`.
- Search renderer for `switch`/`Record<IssueStatus, ...>` usages and add the `triage` arm (likely: `classify.ts`, `status-dot.tsx`, `pill-tab.tsx` consumers).
- Add `assigneeId: string | null` to the `Issue` shape so the renderer can implement the "Mine only" toggle without re-querying.

### 2. Linear client — team-wide triage fetch

In `.agents/skills/linear/reference/linear.mjs`, add a new operation:

```js
async function fetchTeamTriage(teamId) {
  // GraphQL: issues where team.id == teamId AND state.type == "triage"
  // Return same shape as fetchAssignedIssues, plus assignee { id } | null.
}
```

- Document in `.agents/skills/linear/SKILL.md` under Reads.
- Expose through `linear-service.ts` as `fetchTriage(client, teamId)`.
- Wire into a new IPC channel `linear:fetchTeamTriage` (mirror existing `linear:fetchIssues`).

### 3. Issue list — Triage tab + Mine-only toggle

- `issue-list-panel.tsx`: extend `Tab` union with `'Triage'`. Place it as the first tab (triage is the entry point for new work).
- Combine results from existing assigned-issues fetch with the new team-triage fetch in `use-issues.ts`. De-duplicate by issue id (an issue can theoretically be both assigned and in triage).
- Add a small toggle ("Mine only") visible only when the Triage tab is active. Filters by `assigneeId === currentViewerId`.
- Cache `currentViewerId` in main process after first `getCurrentUser()` call (or fetch fresh on first Triage tab open). Expose via new IPC `linear:getViewerId`.

### 4. Config — `computronRepoPath`

- `src/shared/types.ts` `AppConfig`: add `computronRepoPath: string`.
- `src/main/services/config-store.ts` `DEFAULTS`: add `computronRepoPath: ''`.
- Existing config UI surface (`hooks/use-config.ts` + wherever the user edits config today): add input.
- Validation: empty path is allowed at app start, but **block the "Generate brief" action** if path is empty or invalid.

### 5. Computron health check

- New `src/main/services/computron-checker.ts`: returns `true` iff `computronRepoPath` non-empty, path exists, contains a `.git` directory.
- Wire into `auth-checker.ts` health surface as a new row labelled "Computron".
- Renderer auth panel (`auth-row.tsx`) gains a row. Pattern is identical to existing rows.

### 6. Triage brief generator

Refactor `spec-generator.ts` first so both spec and triage flows can share the spawn machinery:

- Split `buildClaudeArgs` to accept an `extraArgs: readonly string[]` parameter. Existing spec call passes `[]`. Triage call passes `['--add-dir', computronRepoPath, '--allowedTools', 'Read,Glob,Grep']`.
- Rename module to `claude-runner.ts` or keep `spec-generator.ts` and add a generic `streamClaude` alongside `streamSpec`. **Decision pinned:** keep `spec-generator.ts`, export a lower-level `streamClaude` and keep `streamSpec` as a thin wrapper. This avoids touching all spec call sites.

New module `src/main/services/triage-generator.ts`:

- `streamTriageBrief({ issue, computronRepoPath, model, onChunk }) → Promise<string>`.
- Calls `streamClaude` with the triage prompt + extra args.

### 7. Triage prompt

New module `src/main/services/triage-prompt.ts`:

```ts
const SYSTEM = `You are reviewing an unrefined Linear triage issue. Your goal is
to produce a short engineering brief that helps a human reviewer decide what to
do with this ticket.

You have read-only access to the team's main codebase at the current working
directory (mounted via --add-dir). Use Glob and Grep to locate code likely
relevant to the issue. Use Read sparingly — only on files that look directly
related. Cap yourself at roughly 6 tool calls.

Output sections, in this exact order:

1. **What the user likely wants** — 1–3 sentences, plain language.
2. **Likely affected components** — bullet list of file paths or modules in
   the computron repo, one-line reason each.
3. **Open questions for reporter** — bullet list of things ambiguous in the
   issue.
4. **Suggested next step** — one of: "Needs reproduction", "Needs spec",
   "Probable duplicate of <X>", "Ready for spec", "Out of scope" — plus one
   sentence why.

Return only the markdown brief. No preamble, no postscript, no code fences
wrapping the whole output.`;
```

User-prompt body contains issue id / title / priority / labels / description, and an explicit reminder that `cwd` is the computron repo root.

### 8. IPC + renderer plumbing

- New IPC channels (mirror spec channels):
  - `triage:generate` — kicks off stream, returns nothing; pushes deltas via `triage:chunk` events.
  - `triage:write` — persists brief markdown to disk on demand.
  - `triage:done` / `triage:error` — terminal events.
- New `src/main/ipc/triage.ts` and register in `ipc/register.ts`.
- New hook `src/renderer/hooks/use-triage-stream.ts` — copy of `use-spec-stream.ts` adapted for the new channels.
- New component `src/renderer/components/triage-drawer.tsx` — separate from `SpecDrawer`. Renders the brief markdown, a "Generate brief" button (disabled until computron health passes), and a "Write to file" button.
- `app.tsx`: when the user opens a triage issue, mount `TriageDrawer` instead of `SpecDrawer`. Pick by `issue.status === 'triage'`.

### 9. Triage writer

New module `src/main/services/triage-writer.ts` mirroring `spec-writer.ts`:

- Writes brief markdown to `thoughts/tasks/<issueId>/triage-brief.md`.
- Fires only on explicit user button-press — never auto-write.

### 10. Tests

For each new module, add a unit test in the matching `__tests__/` folder following the existing pattern:

- `linear-mapping`: `triage` mapping case.
- `triage-prompt`: snapshot of user prompt for a fixed issue.
- `triage-generator`: spawn-mock test, mirrors `spec-generator` test shape.
- `computron-checker`: missing path / missing `.git` / valid path cases.
- `triage-writer`: writes to expected path, creates folder.

Renderer component test for `TriageDrawer` (existing components have rtl-style tests under `src/renderer/components/__tests__/` — follow that).

---

## Open Questions

- [ ] **`claude` CLI flag syntax** — confirm `--add-dir` and `--allowedTools "Read,Glob,Grep"` flags exist on the version we depend on. If syntax differs (e.g. `--allowed-tools`), pin the corrected form in the implementation plan before coding.
- [ ] **Mine-only default** — Triage tab default state: "Mine only" off (show full team queue) or on (show only my triage)? Recommendation: **off**, because the value of the tab is the team queue; toggle is an escape hatch.
- [ ] **Triage tab placement** — first tab (entry point) or last (cold-storage feel)? Recommendation: **first**.
- [ ] **Viewer-id caching strategy** — fetch once at startup and cache in main, or lazy-fetch on first Triage tab open? Recommendation: **lazy** — keeps startup fast and matches existing on-demand patterns.
- [ ] **Tool-call cap enforcement** — the prompt says "~6 tool calls" but the CLI doesn't enforce it. Acceptable to leave as a soft prompt-level constraint, or do we need a hard limit via `--max-turns` (if such flag exists)?
- [ ] **Triage-brief duplicate prevention** — if the user re-generates a brief, do we overwrite `triage-brief.md` silently, prompt, or version it? Recommendation: **prompt on overwrite**, matching common spec-write behaviour.

---

## Out of Scope (tech-debt candidates)

- **Prefetched gh-API context fallback** — earlier brainstorming considered a `gh api` based context fetcher as a fallback when `computronRepoPath` is unset. Skipped for v1; logged here so we don't lose it.
- **Background brief generation** — briefs are generated on user demand only; no auto-generate on triage-tab open.
- **Multi-repo computron support** — only one configured path. If a team operates across N services, that's a later iteration.
