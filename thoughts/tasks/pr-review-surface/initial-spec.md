# Spec: pr-review-surface — PR review as a first-class surface in Forge

> **Status:** Approved (2026-09-02, v2)
> **Generated:** 2026-09-02
> **Issue:** none (project-level slug)
> **Supersedes:** Draft v1, blocked by `thoughts/tasks/pr-review-surface/spec-review.md` (2 blockers, 8 majors, 6 minors). Resolution table at the end.
> **Sibling initiative:** `thoughts/tasks/embed-plan-review/` — artifact review. This spec covers code review (PRs).

---

## Task Summary

PR review is the owner's highest-frequency Claude activity (80 of 133 computron sessions, Jun–Sep 2026) and already has a mature toolchain: the `pr-review` skill writes findings JSON (schema v1) to `<repo>/.pr-review/pr-review-<id>.json`, and `pr-report` renders it to standalone HTML. Forge becomes the day-to-day surface for that output: cross-repo discovery of every review, native React rendering of findings, and triage state that survives quitting the app. The HTML report stays as the shareable/standalone artifact for people who do not run Forge. Forge consumes schema v1 as a read-only contract; it does not own or redefine it.

---

## Context

### Producer side (outside Forge, unchanged except one additive field)
- `~/.agent-skills/pr-review/` — gather via `gh`/`git` → Codex GPT-5.5 runner → synthesize → JSON per `schema.md` v1. Two hard human gates: external-AI approval (`SKILL.md:112-115`) and the Codex-unavailable HARD STOP (`:148-165`, "Auto mode is not approval"). Phase 5 asks HTML-vs-text, never auto-invokes `pr-report`.
- `~/.agent-skills/pr-report/build.py` + `template.html` — validates version/enums/8 required finding fields and renders filters, critical strip, triage in `localStorage`, prompt and draft composition, gh-command and agent-task copy.

### The real corpus (16 JSON files in `computron/.pr-review/` — 15 findings files plus `review-3642-payload.json`) — what Forge must actually survive
- `pr-review-demo-void-time-entry.json` uses **`schemaVersion: 1`**, not `version`; has no `title`, no `existingComments`, no `githubUrl`; carries unknown fields `sourcePath`/`verifyNote`.
- **Filename ≠ PR number, and PR number is not unique.** `pr-review-3668.json` and `pr-review-3668-3669.json` both report `pr.number: 3668`; `pr-review-ful-62-stack.json` reports `3830`.
- **`pr.number` is null** for local-branch reviews (demo file, `ful-85`).
- `pr-review-ful-85-time-off-timezones.json` has `findings: []`.
- `review-3642-payload.json` sits in the same directory and is not a findings file at all.
- `.pr-review/` is **not gitignored** in computron (`git check-ignore` exits 1) — it is merely untracked.

### Forge side
- IPC: `domain:action` constants in `src/shared/ipc-channels.ts`, registered from `src/main/ipc/register.ts`, typed namespaces on `window.forge` (`src/shared/forge-api.ts`, `src/main/preload.ts`) — every existing namespace declares full signatures.
- `src/main/services/spec-generator.ts` spawns `claude -p --output-format stream-json` with `--permission-mode dontAsk` and closes stdin immediately (`:189`). It is a one-way pipe: **nothing can answer a mid-run prompt.** `streamClaude` accepts `cwd`; `src/main/lib/exec.ts` does not, and hard-codes a 5s timeout.
- `config-store.ts` merges shallowly over `DEFAULTS` where `repoPath`/`computronRepoPath` are `''`. `app.tsx:236-250` renders exactly two zones in a 40/60 grid. `index.ts` has no `setWindowOpenHandler`; `preload.ts` exposes no `shell.openExternal`.

---

## Suggested Approach

```
Phase 1: Findings viewer + durable triage    ← the day-to-day surface
Phase 2: Review queue via gh
Phase 3: Launch a review run (Forge-side preflight consent)
Phase 4: PR comment composer + posting
Phase 5: Findings → agent handoff
```

### Phase 1 — Findings viewer + durable triage

**Layout.** `TopBar` gains an `Issues | Reviews` switch. In Reviews mode `app.tsx` renders `PrListPanel` (left zone) + `PrReviewView` (right zone) — `RightPanel` is not shown; connection status stays in `TopBar`. Each mode owns its own state; switching to Reviews closes any open issue drawer, switching back restores the prior issue selection and tab. No grid change.

**Scan set (no new config key).** Derived at read time from `[computronRepoPath, repoPath]`: `expandHome` → `realpath` → dedupe → keep existing dirs that contain `.pr-review/`. A general repo list belongs with the Phase 5 config UI.

**List identity.** One row per JSON file. Rows are grouped by `groupKey = pr.number ?? pr.branch ?? fileName`; inside a group, newest `reviewedAt` first; groups ordered by their newest `reviewedAt` desc. Two files reporting the same `pr.number` are two rows in one group, disambiguated by file name, which is always shown. Errored rows go in a trailing "Unreadable" group and are never hidden.

**Schema acceptance.** `version` or `schemaVersion` is read as the version (`schemaVersion` is an accepted alias). Neither key present → the file is not a findings document at all and errors as `schema-invalid`; present but not equal to `1` → errored `unsupported-version` naming file and value — never coerced. Unknown fields are preserved and ignored. Required for Forge: version, `pr` object, `pr.reviewedAt` (non-empty ISO string), `pr.branch`, `verdict.status` in enum, `verdict.counts`, `findings` array (may be empty), and per finding the schema's 8 required fields with valid enums. Missing `reviewedAt` → the file is **listed as an errored row**, never sorted or keyed on `undefined`. A `verdict.counts` mismatch against actual findings is a **display note, not an error**.

**Review id.** `reviewId = sha256(realpath(repoPath) + "\0" + fileName).slice(0, 16)`. Opaque; the renderer never sees or sends a filesystem path. Main keeps a `reviewId → absolute path` map rebuilt on each list call and rejects any id not in it (no path traversal). Two clones of the same repo are two realpaths and therefore separate reviews and separate triage.

**IPC contract (verbatim, contractual).**

```ts
// src/shared/ipc-channels.ts
PrListReviews: 'pr:list-reviews';
PrGetReview:   'pr:get-review';
PrGetTriage:   'pr:get-triage';
PrSetTriage:   'pr:set-triage';
AppOpenExternal: 'app:open-external';

// src/shared/types.ts — PrCounts and PrFindings mirror schema.md v1, no more, no less
export interface PrCounts { critical: number; major: number; minor: number; nit: number }
/** The parsed schema-v1 document as written by the skill: `pr`, `verdict`
 *  ({ status, summary, counts: PrCounts }), `findings[]` (the schema's 8 required
 *  fields plus its nullable/optional ones), optional `prIntroDraft`,
 *  `existingComments[]` and `cost`. `schema.md` is canonical; unknown fields are
 *  preserved and ignored, and the version key is normalised to `version: 1`. */
export interface PrFindings { /* per schema.md v1 */ }

export type PrTriageState = 'untriaged' | 'accepted' | 'rejected' | 'fixed';
export type PrRowError =
  | 'unreadable' | 'invalid-json' | 'unsupported-version'
  | 'schema-invalid' | 'missing-reviewed-at';

export type PrReviewRow =
  | { kind: 'ok'; reviewId: string; repoPath: string; fileName: string; groupKey: string;
      prNumber: number | null; branch: string; title: string | null; source: 'github' | 'local-branch';
      status: 'merge-ready' | 'needs-work' | 'blocked'; counts: PrCounts; findingCount: number;
      countsMismatch: boolean; reviewedAt: string }
  | { kind: 'error'; reviewId: string; repoPath: string; fileName: string;
      reason: PrRowError; detail: string };

export interface PrListResult {
  rows: PrReviewRow[];
  repos: { repoPath: string; scanned: boolean; message?: string }[];
}

export interface PrTriageDoc {
  triageVersion: 1; reviewId: string; reviewedAt: string;
  states: Record<string, PrTriageState>;
  postedAt?: string; updatedAt: string;
  resetFromReviewedAt?: string;  // set when a new run reset prior states
}

export type PrGetReviewResult =
  | { kind: 'ok'; reviewId: string; doc: PrFindings; triage: PrTriageDoc }
  | { kind: 'error'; reviewId: string; reason: PrRowError; detail: string };

export type PrTriageSaveResult =
  | { ok: true; doc: PrTriageDoc }
  | { ok: false; message: string; doc: PrTriageDoc };  // doc = last known good, for rollback

// src/shared/forge-api.ts — window.forge.pr
pr: {
  listReviews: () => Promise<PrListResult>;
  getReview: (reviewId: string) => Promise<PrGetReviewResult>;
  getTriage: (reviewId: string) => Promise<PrTriageDoc>;
  setTriage: (reviewId: string, findingId: string, state: PrTriageState) => Promise<PrTriageSaveResult>;
};
app: { openExternal: (url: string) => Promise<{ ok: boolean }> };
```

**Triage persistence.** One document per review at `~/.forge/pr-triage/<reviewId>.json` (`paths.ts` gains `prTriageDir()`), written whole-file, atomically (temp file + `rename`). `setTriage` is acknowledged: the renderer updates optimistically and **rolls back to the returned `doc` and shows an inline error** when `ok` is false. Re-review reuses the same file name with a new `reviewedAt`; on load, if the stored `reviewedAt` differs from the document's, states reset to untriaged, `resetFromReviewedAt` is recorded, and the view shows: **"New review run — triage was reset."**

**Triage transitions.** Untriaged → accepted | rejected | fixed by clicking that state; clicking the active state returns to untriaged (matching `template.html:547+`). `fixed` is user-asserted only in Phase 1. Progress reads `triaged / total`; rejected findings dim but stay in the list unless filtered out.

**Rendered from the document.** Verdict header (status, `verdict.summary` narrative, counts, `pr` metadata, `cost` when present), pinned critical strip, filter chips (severity, category, file, confidence=verified, triage state), finding cards (body, failureScenario, snippet, suggestedFix, `githubUrl`), "copy agent prompt", read-only `existingComments`. Zero findings renders a clean-review state, not an empty list.

**Parity with `template.html` — reproduced.** Verdict summary, counts, cost line, critical strip, the four filter families, card content, tri-state triage with click-to-clear, per-finding agent-prompt copy. **Deliberately dropped in Phase 1:** the editable comment composer, `prCommentDraft` drafts, "copy gh review command", "copy as agent task" (all Phase 4), batch "copy accepted as agent prompt" (Phase 5), "copy all visible" (no demand). The HTML report remains available for all of them, and for sharing. **Visual parity is explicitly not a goal.**

**Canonical-behavior rule (two renderers).** `schema.md` is canonical for the data contract. `build.py`/`template.html` is canonical for *derived text*: `agentPromptFor` (which appends body, failure scenario and suggested fix to `agentPrompt` — `template.html:317`) and the draft fallback chain (`:291`). `agentPromptFor` also supplies its own header — "Review and address this <severity> finding in <file:line>: <title>." — whenever `agentPrompt` is missing or blank, and Forge must reproduce that fallback too. Forge mirrors the composition in `src/shared/pr-prompt.ts`. To make byte equality testable, `agentPromptFor`/`draftFor` are lifted out of `template.html`'s inline `<script>` into a small shared JS module that the template loads and the fixture test imports — there is no module boundary today, and a test that scrapes the `<script>` tag would rot. That lift is a one-time edit to `pr-report`, owned by the same owner. Everything else may diverge.

**External links.** New `app:open-external` handler allowlisted to `https://github.com/` prefixes, backed by `shell.openExternal`; any other URL is refused and logged. Clipboard already works in the renderer.

**No file watcher.** Refresh on surface open plus an explicit refresh button.

**Fixtures (in `src/main/services/__fixtures__/pr-review/`, all derived from the corpus).** `schemaVersion` alias; zero findings; the `3668` / `3668-3669` same-number pair; null `pr.number`; malformed JSON; `version: 2`; required-fields-only finding; no `prIntroDraft`; `reviewedAt` removed.

**Success criteria (falsifiable).**
1. Pointing Forge at computron lists **one row per findings JSON present** (15 at time of writing, out of 16 `*.json` files); `review-3642-payload.json` is not listed as ok — it carries neither `version` nor `schemaVersion`, so it appears as an errored `schema-invalid` row.
2. The `schemaVersion` demo file renders as a normal ok row with 8 findings.
3. The `3668` and `3668-3669` files appear as two rows in one group, newest first, each labelled with its file name.
4. `ful-85` renders a clean-review state with zero findings and no error.
5. A `version: 2` fixture and a malformed-JSON fixture each produce exactly one errored row naming the file and reason.
6. Triage set on a finding survives an app quit and restart; rewriting the JSON with a new `reviewedAt` resets it and shows the reset banner.
7. With `~/.forge/pr-triage` made read-only, clicking a triage state shows an error and the UI reverts to the prior state.
8. Clicking a `githubUrl` opens the system browser; a fixture with a `file://` URL is refused.

### Phase 2 — Review queue via `gh`

`src/main/services/gh-client.ts` runs, per scanned repo with `cwd = repoPath`:

```
gh pr list --author @me --state open --limit 50 \
  --json number,title,author,baseRefName,headRefOid,updatedAt,url,isDraft,statusCheckRollup
gh pr list --search "review-requested:@me" --state open --limit 50 --json <same fields>
```

`gh search prs --json` does **not** expose `baseRefName`, `statusCheckRollup` or `headRefOid` (verified on gh 2.92.0); `gh pr list` does. **Prerequisite:** `src/main/lib/exec.ts` gains caller-controlled `cwd` and `timeoutMs` on both `tryExec` and `tryExecFile` (default stays 5000; gh calls use 20000).

Queue rows show title, author, base, CI rollup, age, and whether a findings file exists for that PR — joined on `pr.number`, which excludes local-branch reviews (`pr.number: null`) by construction. `gh` is added to `AuthStatus` (a fixed 4-field shape today) and to **both** `top-bar.tsx` and `right-panel.tsx`, which enumerate rows manually. Results cached at `~/.forge/pr-queue.json` in the style of `issues-cache.ts`.

**Staleness (owner decision).** The skill gains one additive optional field, `pr.reviewedHeadSha`, written from `headRefOid` at gather time. Forge treats it as optional: absent → **"staleness unknown"**; equal to the queue's `headRefOid` → "current"; different → "stale — head moved". A secondary `reviewedAt < updatedAt` hint is shown as *may be stale* when the SHA is absent. No SHA comparison is ever claimed for the 14 existing files.

**Deliberate call: `gh` CLI, not the REST/GraphQL API.** The user is already authenticated to `gh`, the skill uses it, and Forge stores no tokens.

**Success criteria.** Queue for computron lists the same open PRs as `gh pr list` run manually in that repo; each row with a matching findings file links to its newest row from Phase 1; every row shows one of current / stale / unknown, and all 15 existing reviews show "unknown".

### Phase 3 — Launch a review run (Forge-side preflight consent)

**Why this shape.** `claude -p` runs with `--permission-mode dontAsk` and a closed stdin, so the skill's two human gates can never be answered mid-run. Forge therefore satisfies them **before** spawning, in its own UI, and never bypasses them:

1. **Codex preflight — Forge runs the same probe the runner does:** `codex exec` with the prompt `Reply with exactly: CODEX_OK`, low effort, 90s timeout, output must contain `CODEX_OK`. On failure Forge **does not spawn**. It shows the reason verbatim, states plainly that the only fallback is ~11 Opus 5 agents, and offers Cancel or "retry preflight" — never an automatic fallback.
2. **External-AI consent** — a Forge dialog naming the repo and stating that diff and context are sent to external Codex/OpenAI agents. Explicit click required, recorded per run.
3. **Delivery choice** — Forge asks the skill's Phase 5 question (interactive HTML report vs plain-text summary) up front.

`src/main/services/pr-review-runner.ts` then spawns `claude -p` via `streamClaude` with `cwd = repoPath` and a prompt carrying all three answers. Progress renders as a status line, not a terminal pane. On completion Forge re-scans and opens the new review; `notifications.ts` fires.

**Required one-line skill change (owner maintains the skill).** With `SKILL.md` as written, the gates say "stop and ask … WAIT for an explicit affirmative" in-session, so a pre-answered prompt is not literally compliant. Add one sentence to the gate section:

> A caller may pre-answer these gates by supplying `externalAiApproved: true`, `codexPreflight: "ok"`, and `deliver: "html" | "text"` in the invocation; treat each supplied value as the human's explicit answer and do not re-ask. Absent those keys, the gates stand as written. `codexPreflight` may never be supplied as anything but `"ok"`, and it pre-answers only availability at launch: if a runner returns `codex-unavailable` at any point during a pre-answered run, **abort** — write no findings JSON, never fall back to Opus, and exit non-zero with the returned reason as the last line of stderr.

The abort clause matters because Forge's preflight cannot prevent a mid-run Codex failure, and a pre-answered run has no human to ask. Forge surfaces a non-zero exit as a **failed launch** showing the reason verbatim, leaves the previous review untouched, and offers retry. Until the skill accepts both halves of this sentence — the pre-answer keys and the abort clause — Phase 3 does not ship. **Deliberate call: spawn the skill, never reimplement it** — review quality lives in the skill, and terminal-started and Forge-started runs must produce byte-identical output.

**Success criteria.** With Codex logged out, launching from Forge produces the stop dialog with the runner's reason and spawns nothing. With Codex available, a run started from Forge writes a `.pr-review/*.json` indistinguishable in shape from one started in a terminal, and the new review appears in the list without a manual refresh.

### Phase 4 — PR comment composer + posting

Composer built from `prIntroDraft` + each accepted finding's `prCommentDraft` via `template.html`'s fallback chain, fully editable, `inline: false` findings folded into the body. Posting goes through `gh api repos/{owner}/{repo}/pulls/{n}/reviews` as a single review, in `pr-comment-poster.ts`, **behind an explicit confirm dialog showing the exact payload**, never from a background process, one-shot with `postedAt` recorded in the triage document so a double-post is visible. Local-branch reviews cannot post. "Copy gh command" and "copy as agent task" ship here as escape hatches.

### Phase 5 — Findings → agent handoff

Concatenate accepted findings' composed agent prompts into a task, write it under `thoughts/tasks/<repo>-pr-<n>/`, and spawn through whatever the roadmap's Agent Runner provides. **Deferred until that runner exists** — a bespoke spawner here would be the second one thrown away.

---

## Cross-phase decisions

- **Read JSON from disk; never run the skill in-process.** The filesystem is already the integration point for terminal, scheduled and Forge-started runs alike.
- **Triage lives in `~/.forge/`, not the repo.** Not because `.pr-review/` is gitignored — it is not — but because writing sidecars into another tool's output directory couples two file layouts, and `rm -rf .pr-review` would take the triage with it.
- **Forge state never enters the skill's JSON.** `reviewedHeadSha` is the exception only because it is producer-time knowledge nothing else can recover.
- **No shared review-pane abstraction with `embed-plan-review` yet** — different data and interaction models; revisit when both exist. **`pr-report` HTML stays the shareable artifact**; Forge does not shell out to `build.py`.

### Files

```
src/main/services/  pr-findings-reader.ts, pr-findings-schema.ts, pr-triage-store.ts
                    gh-client.ts (P2), pr-review-runner.ts (P3), pr-comment-poster.ts (P4)
src/main/ipc/       pr-review.ts, app.ts (open-external)
src/main/lib/       paths.ts (+prTriageDir, +prQueueCachePath), exec.ts (+cwd, +timeoutMs)
src/shared/         types.ts, ipc-channels.ts, forge-api.ts, pr-prompt.ts
src/renderer/       hooks/use-pr-reviews.ts, use-pr-triage.ts
                    components/pr/{pr-list-panel,pr-review-view,verdict-header,
                                   finding-filters,finding-card,existing-comments}.tsx
Modified:           preload.ts, ipc/register.ts, app.tsx, top-bar.tsx,
                    right-panel.tsx (P2), auth-checker.ts (P2), index.ts (window open handler)
```

---

## Open Questions

1. **Colleagues' PRs in repos that are not cloned.** The skill writes into `<repo>/.pr-review/`, presupposing a clone. Require a clone, use a throwaway worktree, or have Forge own `~/.forge/pr-review/<owner>/<repo>/` and teach the skill an output-path argument? Blocks Phase 2 completeness only.
2. **Posting granularity (Phase 4).** One GitHub review with inline comments (strawman) vs. individual comments vs. one rolled-up issue comment. The composer's shape follows from the answer; belongs in the Phase 4 plan, not this gate.

---

## Out of scope (all phases)

Reimplementing any part of the review pipeline; full diff or file-tree rendering; merging/approving/requesting changes; webhooks or always-on polling; multi-user or shared triage; a config UI (roadmap Phase 5).

---

## Resolution of review findings

| # | Resolution |
|---|---|
| B1 Phase 3 gates unimplementable | **Owner-decided + resolved:** gates hoisted to Forge-side preflight (Codex probe, external-AI consent, delivery choice) before spawn; `streamClaude` reuse no longer claimed for gate handling. States the exact one-sentence `SKILL.md` change required, without which Phase 3 does not ship. |
| B2 corpus ≠ assumed schema | **Owner-decided + resolved:** `schemaVersion` accepted as an alias of `version` (both must equal 1); list identity is one row per file, grouped by `pr.number ?? branch ?? fileName`, newest first, file name always shown; null `pr.number` handled; zero-findings and non-findings-JSON cases specified; nine fixtures named. |
| M1 no zone for the findings view | Resolved: Reviews mode replaces both zones (`PrListPanel` + `PrReviewView`); `RightPanel` hidden, connections stay in `TopBar`; per-mode state retention specified. |
| M2 "whole value of pr-report" overclaimed | Resolved: claim deleted. Explicit reproduced list (now including `verdict.summary`) and an explicit dropped list with reasons; HTML report keeps its role. |
| M3 `prReviewRepos` default is broken | Resolved: config key dropped; scan set derived at read time from the two existing paths. |
| M4 no executable IPC/persistence contract | Resolved: verbatim channel names and type signatures, opaque `reviewId` with a main-side id→path map, versioned triage document, whole-file atomic writes, acknowledged writes with rollback and an inline error. |
| M5 validation boundary undefined | Resolved: Forge's own required/optional list enumerated (`pr`, `reviewedAt`, enums); counts mismatch is a display note, not an error. |
| M6 gh queries + `exec.ts` | Resolved: two `gh pr list` invocations with verified fields (`--search "review-requested:@me"` for the second); `exec.ts` gains `cwd` and `timeoutMs` as a stated prerequisite. |
| M7 staleness unimplementable | **Owner-decided:** additive optional `pr.reviewedHeadSha`; Forge treats it as optional and shows "unknown" when absent, with a `reviewedAt` vs `updatedAt` hint as the weaker signal. |
| M8 open questions already answered | Resolved: eight reduced to two (uncloned repos, posting granularity); Q1/Q3/Q4/Q5/Q7/Q8 decided in the body. |
| M9 two renderers, no ownership rule | Resolved: canonical-behavior rule — `schema.md` owns the contract, `template.html` owns derived text (`agentPromptFor`, draft fallbacks), mirrored in `pr-prompt.ts` with a byte-equality fixture test; visual parity explicitly not guaranteed. |
| m1 triage states have no workflow | Resolved: transition table — click active state clears to untriaged, `fixed` is user-asserted, progress is `triaged / total`, rejected dim not hidden. |
| m2 re-review strands prior triage | Resolved: triage keyed on `reviewId` with `reviewedAt` stored inside; mismatch resets states, records `resetFromReviewedAt`, and shows a reset banner. |
| m3 `.pr-review/` not gitignored | Resolved: false claim removed; the `~/.forge` decision restated on the coupling/deletion rationale. |
| m4 triage key uses raw `repoPath` | Resolved: `realpath` in the id derivation; stated that two clones get separate triage. |
| m5 no external-link path | Resolved: `app:open-external` allowlisted to `https://github.com/`, with a refusal test. |
| m6 auth plumbing + file inventory | Resolved: `right-panel.tsx` and `AuthStatus`'s fixed shape called out in Phase 2; file inventory marks per-phase ownership. Card-level detail (collapse default, copy feedback, diff coloring, strip navigation) **deferred to the Phase 1 plan** — plan-level, not spec-level. |

---

## Approval gate

Spec approved → owner picks a phase (default: Phase 1) → `superpowers:writing-plans` into `thoughts/tasks/pr-review-surface/plans/<plan-slug>.md` → plan approved → execute. One phase planned at a time.
