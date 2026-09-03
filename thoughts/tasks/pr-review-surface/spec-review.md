# Spec review — pr-review-surface (Draft)

> Adversarial review: 3 independent GPT-5.5 lenses (architecture, scope, UX), consolidated and
> verified against source by Opus 5 on 2026-09-02. Every blocker/major below was checked against the
> file it cites; reviewer line numbers and claims were corrected where wrong.

## Verdict

**BLOCK** — two confirmed blockers. Both need an owner decision, not just an editing pass. The
direction (native React, read JSON from disk, triage in `~/.forge`, phase order) is sound and should
survive the rewrite. Phase 1 is roughly right in *shape* and wrong in *contract*: it names channels
and files but never fixes the decisions an implementer would have to invent.

Blockers: 2. Majors: 8. Minors: 6.

## Blockers

### B1 — Phase 3's runner cannot implement the gates Phase 3 promises

- **Where:** spec:76 ("reusing the `streamClaude` machinery"; "hard gates … surface as blocking prompts").
- **Evidence:** `src/main/services/spec-generator.ts:39-40` passes `--permission-mode dontAsk`, and
  `:189` calls `claude.stdin.end(...)` immediately. It is a one-way pipe: nothing can answer a prompt.
  The skill has two hard human gates — external-AI approval (`~/.agent-skills/pr-review/SKILL.md:112-115`)
  and the Codex-unavailable HARD STOP (`:148-165`, which explicitly says "Auto mode is not approval").
  A `dontAsk` one-shot either hangs at those gates or the model routes around them.
- **What must change:** Either (a) hoist both gates to Forge-side *preflight* state (Forge asks for
  external-AI consent and probes Codex availability before launching, passing the result in the
  prompt), or (b) drop Phase 3 until the roadmap's Agent Runner exists. Do not describe Phase 3 as
  "reuse `streamClaude`" — that is the one thing it cannot be.
- **Note on the convention argument:** two lenses also cited `thoughts/conventions.md:55` ("do not
  spawn agents or processes outside the Agent Runner IPC channel"). That is only PARTIAL — Forge
  already spawns `claude` from `spec-generator.ts` and shells out from `spec-review-bridge.ts`, and
  no Agent Runner exists (no `node-pty`/`xterm` anywhere in `src/` or `package.json`). The
  interactivity problem is the real blocker; the convention is aspirational today.

### B2 — The real findings corpus does not match the schema the spec assumes

- **Where:** spec:98 (`version !== 1` refused), spec:68 ("joined on `pr.number`"), spec:148.
- **Evidence:** Across the 14 real files in `/Users/alvarocarvalho/desenv/creteSuite/computron/.pr-review/`:
  - `pr-review-demo-void-time-entry.json` uses **`schemaVersion: 1`, not `version`**, has no
    `pr.title`, no `existingComments`, no `githubUrl`, and carries unknown fields `sourcePath` /
    `verifyNote`. Under spec:98 it becomes an errored row — the newest demo review in the corpus.
  - **PR identity is not 1:1 with files.** `pr-review-3668.json` and `pr-review-3668-3669.json` both
    report `pr.number: 3668` (different branches, different `reviewedAt`); `pr-review-ful-62-stack.json`
    reports `pr.number: 3830` while its filename says `ful-62`. Filename ≠ PR number, and one PR
    number maps to several files.
  - `pr-review-ful-85-time-off-timezones.json` has **zero findings** — the clean-review case.
- **What must change:** Decide (owner) whether Forge accepts `schemaVersion` as an alias or lists that
  file as errored. Then replace "joined on `pr.number`" with an explicit rule for list identity:
  is a row one *file*, or the newest review per `(repo, number)`? Both are defensible; the spec
  must pick one, because the queue join, the "new run resets triage" banner, and the stale marker
  all hang off it. Add the zero-findings and `schemaVersion` files as named fixtures.

## Majors

**M1 — The Reviews layout has no zone for the findings view.** spec:52 swaps `IssueListPanel` for
`PrListPanel` and says "`RightPanel` stays", but `src/renderer/app.tsx:236-250` renders exactly two
zones in a 40/60 grid (`tokens.css:80-85`), so `pr-review-view.tsx` has nowhere to mount. Also
undefined: what happens to the open spec/triage drawer, issue selection, and filters on mode switch.
Specify the exact tree per mode and what state each mode keeps.

**M2 — "The whole value of `pr-report`" is both overclaimed and unearned.** Phase 1's viewer omits
`verdict.summary` (the narrative — `template.html:534`), the editable composer, "copy accepted as
agent prompt", and "copy all visible". Meanwhile the scope lens argues the opposite: the *new* value
in Phase 1 is only cross-repo discovery + Forge-owned triage; everything else already works in
`template.html` today, and real HTML reports sit next to every JSON in the corpus. Both critiques
attack the same undefended sentence. Either enumerate the Phase 1 regressions explicitly, or split
Phase 1 into discovery+triage first and the full native viewer second. Delete "HTML is no longer
needed" either way — it is not falsifiable.

**M3 — `prReviewRepos` cannot be a `DEFAULTS` field, and probably should not exist yet.**
`config-store.ts:7-13` has `repoPath` and `computronRepoPath` as empty strings, and `readMerged` at
`:20-25` does a shallow `{...DEFAULTS, ...parsed}` — a static default of `[computronRepoPath, repoPath]`
resolves to `['','']` for every existing user. Simplest fix, and the one I'd take: Phase 1 derives
the scan set at read time from the two existing paths (distinct, non-empty, existing dirs) and adds
no new config key. A general repo list belongs with the Phase 5 config UI.

**M4 — Phase 1 has no executable IPC or persistence contract.** `forge-api.ts:21+` and `preload.ts`
declare full signatures for every existing namespace; the spec gives only channel names. Missing:
`PrReviewSummary` shape, tagged ok/error rows, a stable opaque `reviewId` (renderer must not hand
main a filesystem path), the triage document shape and its own version field, per-finding vs
whole-file write granularity, atomic write (temp+rename), and — flagged separately by the UX lens —
what happens when a triage write *fails*. "Optimistic update + write-through" with no ack, rollback,
or error surface directly contradicts the phase's one promise, that triage is durable.

**M5 — "Validate against schema v1" is not yet a boundary, and copying `build.py` would not fix it.**
Verified: `build.py:20-52` *does* check `version == 1`, `verdict.status`, the eight required finding
fields, and the three enums — the arch lens undersold it. What it does **not** check is exactly what
Forge depends on: `pr` shape, `pr.reviewedAt` (Forge sorts by it *and* keys triage on it), and
`verdict.counts` consistency (`schema.md:63`). Enumerate required/optional/nullable per Forge's own
needs, and decide whether a counts mismatch is an error or a display note (recommend: note, not error).

**M6 — The Phase 2 `gh` queries cannot return the promised columns, and `exec.ts` cannot run them.**
Verified on gh 2.92.0: `gh search prs --json` fields are `assignees, author, …, number, repository,
state, title, updatedAt, url` — no `baseRefName`, no `statusCheckRollup`, no `headRefOid`. Those
exist only on `gh pr list`. Fix: per-repo `gh pr list --search "review-requested:@me"` and
`gh pr list --author @me` with `-R owner/repo`. Separately, `src/main/lib/exec.ts:19-31` hard-codes a
5s timeout and accepts no `cwd` — both `tryExec` and `tryExecFile` need caller-controlled `cwd` and
timeout before any `gh` work. (`streamClaude` already takes `cwd`; the exec helpers do not.)

**M7 — Stale-review detection is unimplementable for every review that already exists.** `schema.md`
carries no commit SHA, and the producer's gather step (`SKILL.md:39`) requests `headRefName`, not
`headRefOid` — so the reviewed head SHA was never recorded. `gh pr list --json headRefOid` gives the
*current* SHA, which cannot be compared to anything. Either ask the skill to record `reviewedHeadSha`
(a v1.1 additive field), or drop the SHA promise and mark staleness from `pr.reviewedAt` vs the PR's
`updatedAt` — approximate, honest, and available today. Phase 2's scope text and Open Question 7
currently contradict each other.

**M8 — Most "open questions" are already answered by the spec itself.** Q3 is answered at spec:98/102,
Q4 at spec:104, Q5 and Q8 are decided in Phase 1's own scope, Q1 is decided by M3. Leaving them open
makes an approval gate on eight items that are really three (Q2 uncloned repos, Q6 posting
granularity, Q7 staleness) — and Q2/Q6 belong in the Phase 2/4 documents, not the Phase 1 gate.

**M9 — Two renderers, no ownership rule.** `build.py` + `template.html` and the new React viewer will
diverge in validation, triage identity, and prompt construction. One concrete trap: `template.html:317`
`agentPromptFor()` does not copy `agentPrompt` verbatim — it appends title, location, failure scenario
and suggested fix. A naive Forge "copy agent prompt" produces a *different* (weaker) prompt than the
HTML report for the same finding. Declare which implementation is canonical for each behavior and
that UI parity is explicitly not guaranteed.

## Minors

- **Triage states are labels, not a workflow.** No transition table: does clicking the active state
  return to untriaged (the HTML does — `template.html:547+`), is `fixed` user-asserted or agent-verified,
  what fades, what counts toward `done/total`?
- **Re-review strands prior triage silently.** New `reviewedAt` → fresh key → old decisions vanish
  from the UI while the old file stays on disk. Needs at minimum a "new run — triage reset" banner.
- **`.pr-review/` is NOT gitignored** (NEW). `git check-ignore` in computron exits 1; the directory is
  merely untracked. The spec's stated rationale at spec:102 is factually wrong — though the conclusion
  (triage lives in `~/.forge`) still holds for the coupling reason.
- **Triage key uses a raw `repoPath`** — no `realpath`; `paths.ts:4-7` only expands `~`. Two clones or
  a trailing slash produce divergent triage. Say whether clones share triage.
- **No external-link path.** `src/main/index.ts` creates the window with `nodeIntegration: false` and
  no `setWindowOpenHandler`; `preload.ts` exposes no `shell.openExternal`. `githubUrl` links need a
  narrow `app:open-external` allowlisted to `https://github.com/`. (Clipboard is fine — already used.)
- **Phase 2 auth plumbing is under-listed**: `AuthStatus` (`types.ts:39`) is a fixed 4-field shape and
  both `top-bar.tsx` and `right-panel.tsx` enumerate rows manually; `right-panel.tsx` is missing from
  the changed-files list. Also: the file inventory mixes P2–P5 files into what is meant to be a
  one-phase-at-a-time gate; and card-level behavior (collapse default, ~1.4KB `agentPrompt` copy
  feedback, diff coloring, critical-strip navigation) is unspecified but is plan-level, not spec-level.

## Recommendation

1. **Owner decision, blocking:** accept `schemaVersion` as an alias for `version`, or let the demo
   file show as an errored row? And is a list row one *file* or the newest review per PR? (B2)
2. **Owner decision, blocking:** cut Phase 3 to "deferred until the Agent Runner exists", or redesign
   it as Forge-side preflight consent + a one-shot run that can never hit a mid-run gate. (B1)
3. **Owner decision, cheap:** ask the `pr-review` skill for an additive `reviewedHeadSha`, or drop
   SHA-based staleness for a `reviewedAt`-vs-`updatedAt` approximation. (M7)
4. **Just decide these in the rewrite, no owner input needed:** drop `prReviewRepos` and derive the
   scan set from the two existing config paths (M3); close Open Questions 1/3/4/5/8 and move 2/6 into
   their own phase docs (M8); specify the Reviews component tree and mode-switch state (M1); replace
   "HTML is no longer needed" with a named parity/non-parity list including `verdict.summary` (M2).
5. **Add an executable Phase 1 contract section:** opaque `reviewId`, every IPC payload/result type, a
   versioned triage document, atomic writes, acknowledged writes with rollback-on-failure, and the
   triage state transition table (M4, minors 1–2).
6. **Add named fixtures before planning:** `schemaVersion` file, zero-findings file, two-files-one-PR
   pair, malformed JSON, `version: 2`, required-fields-only finding, missing `prIntroDraft`. All seven
   exist or are trivially derivable from the computron corpus — no invention needed.

## Verification log

| # | Lens(es) | Status | Evidence |
|---|---|---|---|
| B1 | arch, scope, ux | CONFIRMED | `spec-generator.ts:39-40` `dontAsk`; `:189` `stdin.end`; `SKILL.md:112-115`, `:148-165` gates |
| B1 (convention half) | arch, scope | PARTIAL | `conventions.md:55` says so, but `spec-generator.ts`/`spec-review-bridge.ts` already spawn; no Agent Runner in `src/` |
| B2 (`schemaVersion`) | arch (as evidence) | CONFIRMED | `pr-review-demo-void-time-entry.json` top keys = `schemaVersion, pr, verdict, findings` |
| B2 (PR identity) | — | NEW | `3668.json` and `3668-3669.json` both `pr.number: 3668`; `ful-62-stack.json` → `pr.number: 3830` |
| M1 | arch, ux | CONFIRMED | `app.tsx:236-250` = `IssueListPanel` + `RightPanel`; `tokens.css:80-85` 40/60 grid |
| M2 | ux, scope | CONFIRMED | spec:54 lists no `verdict.summary`; `template.html:534` renders it; 11 HTML reports exist beside the JSONs |
| M3 | arch, scope | CONFIRMED | `config-store.ts:7-13` both paths `''`; `:20-25` shallow merge only |
| M4 | arch, ux | CONFIRMED | `forge-api.ts:21+` declares full signatures; spec names channels only, no shapes, no failure path |
| M5 | arch | PARTIAL | `build.py:20-52` *does* check version/enums/required fields; it does not check `pr`, `reviewedAt`, or counts |
| M6 | arch | CONFIRMED | gh 2.92.0 `search prs --json` has no `baseRefName`/`statusCheckRollup`/`headRefOid`; `exec.ts:19-31` no `cwd`, 5s fixed |
| M7 | arch, scope, ux | CONFIRMED | `schema.md:6-17` no SHA; `SKILL.md:39` gathers `headRefName` not `headRefOid` |
| M8 | scope | CONFIRMED | Q3↔spec:98/102, Q4↔spec:104, Q5/Q8 decided in Phase 1 scope |
| M9 | scope | CONFIRMED | `template.html:317` `agentPromptFor()` appends details beyond `agentPrompt`; `:291` `draftFor` precedence |
| Phase 4 fallbacks/anchors | arch | CONFIRMED | `schema.md:64` drafts optional; `template.html:291` fallback chain; `:399` payload/anchor handling |
| Phase 5 approval gate | arch | PARTIAL | `AGENTS.md:62/95` gates *specs*, not PR findings — extrapolation; slug collision + null `pr.number` are real |
| `.pr-review` gitignored | — | NEW/REFUTES spec:102 | `git check-ignore` exit 1 in computron; dir is untracked, not ignored |
| Zero-findings review | ux (implied) | NEW | `pr-review-ful-85-time-off-timezones.json` has `findings: []` |
| External links | arch | CONFIRMED | `index.ts` no `setWindowOpenHandler`; no `shell`/`openExternal` in `preload.ts` |
| Auth plumbing | arch | CONFIRMED | `types.ts:39` 4 fixed fields; `right-panel.tsx` absent from spec's changed-files |
| Triage key canonicalization | arch | CONFIRMED | `paths.ts:4-7` expands `~` only, no `realpath` |
| Skill path `~/.claude/skills/` | scope (cited) | REFUTED as an issue | `~/.claude/skills/pr-review` is a symlink to `~/.agent-skills/pr-review` — both citations valid |

---

# Re-review — Draft v2

> Verifier pass by Opus 5, 2026-09-02. Every v2 claim below was re-checked against the cited file,
> the live corpus, `gh 2.92.0`, and the Forge source — not against v2's own resolution table.

## Verdict

**APPROVE-WITH-NOTES.** 15 of 17 findings resolved, 1 owner-deferred, 1 partial (Phase-3-only).
Two new findings, both editable in place — neither needs an owner decision or a redesign.
N1 must be corrected before Phase 1 planning (it is a falsifiable acceptance criterion that is false today).

Resolved 15 · Deferred-OK 1 · Partial 1 · Unresolved 0 · New 2 major, 2 minor.

## Per-item status

| # | Status | Evidence |
|---|---|---|
| B1 gates unimplementable | PARTIAL | Preflight matches the runner exactly (`codex-runner.mjs:211-219`: same prompt, `effort: 'low'`, `seconds: 90`). Residual: see N2. |
| B2 corpus ≠ schema | RESOLVED | Re-validated all 15 findings files against v2's required set: all pass; only the demo file lacks `pr.title`, which v2 types `string \| null`. Count is wrong — N1. |
| M1 no zone | RESOLVED | `app.tsx:232-250` = two zones; v2 replaces both in Reviews mode and keeps auth in `TopBar`, which already receives `auth`. |
| M2 overclaim | RESOLVED | Claim deleted; reproduced/dropped lists are explicit and `verdict.summary` (`template.html:534`) is in the reproduced list. |
| M3 `prReviewRepos` | RESOLVED | No new config key; `config-store.ts:7-13` DEFAULTS untouched. |
| M4 no IPC contract | RESOLVED | Channel names, tagged rows, opaque `reviewId`, versioned doc, atomic write, ack+rollback all present and shaped like `forge-api.ts`/`preload.ts`. Two undefined type names — N3. |
| M5 validation boundary | RESOLVED | Forge's own required/optional list enumerated; counts mismatch demoted to a display note. |
| M6 gh + exec | RESOLVED | `gh pr list --help` (2.92.0) confirms `-A/--author`, `-S/--search`, `-s/--state`, `-L/--limit`, and JSON fields `baseRefName`, `headRefOid`, `statusCheckRollup`, `isDraft`, `updatedAt`, `url`. `src/main/lib/exec.ts:10-32` hard-codes `timeout: 5000` and takes no `cwd` — prerequisite correctly stated, correct path. |
| M7 staleness | DEFERRED-OK | Owner decision; Forge treats `reviewedHeadSha` as optional, no SHA claim for existing files. |
| M8 open questions | RESOLVED | Eight → two, both correctly pushed to phase docs. |
| M9 two renderers | RESOLVED | `agentPromptFor` **does** exist (`template.html:317`) and appends body/failureScenario/suggestedFix as v2 states. `draftFor` is at `:293`, not `:291` (v2 cites the comment block) — harmless. See N4. |
| m1 triage workflow | RESOLVED | Toggle-to-clear verified at `template.html:554-556`. |
| m2 re-review strands triage | RESOLVED | `reviewedAt` stored in the doc, reset + banner + `resetFromReviewedAt`. Grouping mirrors `STORE_KEY` at `:548` (`number ?? branch`). |
| m3 gitignore | RESOLVED | `git check-ignore .pr-review` exits 1 — false claim removed, rationale restated. |
| m4 raw repoPath | RESOLVED | `realpath` in the id derivation; clone behavior stated. |
| m5 external links | RESOLVED | `index.ts:55-56` has `contextIsolation`/`nodeIntegration` but no `setWindowOpenHandler`; `app:open-external` allowlist plus a refusal test. |
| m6 auth + inventory | RESOLVED | `AuthStatus` (`types.ts:39-44`) 4 fixed fields and `right-panel.tsx` both called out; card detail deferred to plan with a reason. |

## New findings

**N1 (major, text edit) — the corpus counts in v2 are wrong, and one success criterion contradicts
the version rule.** `.pr-review/` holds **16** `*.json` files today, **15** of which are findings
files (`ful-62-stack` and `3841` post-date the v1 review). Success criterion 1 ("lists **14 rows**")
and Phase 2's "all 14 existing reviews show unknown" are false as written. Separately, criterion 1
requires `review-3642-payload.json` to error as `schema-invalid`, but v2's acceptance rule sends a
file whose version is neither `1` nor present to `unsupported-version`. Fix: state the criterion as
"one row per findings JSON present (15 at time of writing)", and add "version key absent →
`schema-invalid`; present but ≠ 1 → `unsupported-version`".

**N2 (major, Phase 3 only) — the pre-answer sentence does not cover a mid-run Codex failure.**
Forge's preflight passing does not stop the runner's own preflight (`codex-runner.mjs:211-224`) or a
later dimension from returning `codex-unavailable`, which re-enters the HARD STOP (`SKILL.md:148-165`)
that a `dontAsk` one-shot cannot answer. `codexPreflight: "ok"` pre-answers availability, not the
"fall back to ~11 Opus 5 agents?" question. Add to the proposed sentence: a mid-run `codex-unavailable`
is an **abort with no JSON written and no fallback**, and Forge reports the run as aborted with the
runner's reason. Phase 3 already does not ship without a skill edit, so this rides along with it.

**N3 (minor).** The "verbatim, contractual" type block references `PrCounts` and `PrFindings`, neither
of which is defined anywhere in the spec. Derivable from `schema.md`, but name them.

**N4 (minor).** The byte-equality fixture test needs `agentPromptFor` lifted out of `template.html`'s
inline `<script>` (there is no module boundary) — say so in the plan. Also note the function's fallback
header for a blank/missing `agentPrompt`; v2's one-line description covers only the append path.

## Notes

Nothing else new. The IPC surface matches Forge's existing conventions (`domain:action` constants,
object-wrapped `invoke` payloads, fully-typed namespaces); `reviewId` derivation is sound and closes
the path-traversal hole; the triage document shape and write-failure behavior are complete.
Two accepted consequences worth carrying into the plan, not blockers: `getReview`/`getTriage` reject
any id not in the map rebuilt by the last `listReviews`, so the renderer must list before it reads;
and `getTriage` is redundant with `getReview`'s embedded `triage`.

## v2.1 edits (applied to the spec, same day)

N1 ✅ corpus corrected to 16 JSON / 15 findings files; criterion 1 now reads "one row per findings JSON present", and a file with neither version key routes to `schema-invalid` (kept `unsupported-version` for a present-but-wrong value). N2 ✅ the skill sentence now aborts a pre-answered run on mid-run `codex-unavailable` — no JSON, no Opus fallback, non-zero exit with the reason — surfaced by Forge as a failed launch; Phase 3 ships only once the skill accepts both halves. N3 ✅ `PrCounts` and `PrFindings` defined in the contractual block from `schema.md`. N4 ✅ `agentPromptFor`/`draftFor` to be lifted out of `template.html`'s inline script into a shared module the fixture test imports, with the blank-`agentPrompt` fallback header described.
All four are now RESOLVED; the APPROVE-WITH-NOTES verdict stands with no open notes.
