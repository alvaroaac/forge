# Spec review — embed-plan-review

- **Date:** 2026-09-02
- **Spec reviewed:** `thoughts/tasks/embed-plan-review/initial-spec.md`, Draft v3 (2026-05-22)
- **Method:** three independent Codex (GPT-5.5) adversarial passes — architecture/feasibility, scope/YAGNI, UX/agent round-trip — followed by Opus verification of every blocker and major against the spec text, Forge's source, and the `~/desenv/personal/plan-review` monorepo. 30 raw findings verified and deduped into 18.

## Verdict

**BLOCK.** Three confirmed blockers and nine confirmed majors. The spec is a good survey of *what a rich review UI could be* but is not yet a decision document: the central data contract (what a comment is, what gets saved, what reaches the agent) is undefined, the human approval verdict disappears, and the build-vs-reuse decision rests on a comparison table that is factually wrong about the tool being replaced.

## Consolidated issues

### 1. [BLOCKER] There is no review session or submission contract

*Lenses: arch, scope, ux.* Phase 1 has comments in a draft, a `Save to File` that the cross-phase section says serializes "the current in-memory markdown source" (`initial-spec.md:194` — i.e. the artifact, not the comments), a `ReviewSaveInput` carrying only `{markdown}` (`:252`), and a `ReviewReviseInput.reviewFeedback: string` (`:257`) with no producer anywhere in the spec. Core's formatter is explicitly excluded (`:186`). There is no Phase-1 type for a comment, thread, reply, author, timestamp, or resolution state — only anchors. The overview also contradicts itself: `:18` says save does HTML→markdown with HTML islands, `:194` says no HTML→md conversion happens in Phase 1–2. Note `@plan-review/core` already ships exactly this contract — `ReviewSubmission {comments, verdict, summary}`, `ReviewClient.submitReview`, and `formatReview()` (`packages/core/src/types.ts:44`, `reviewClient.ts:16`, `formatter.ts:24`) — and the spec discards it without a reason.

**Decision needed:** define one versioned `ReviewSession` (artifact identity + hash, ordered threads with stable ids, messages, author, resolution) and one deterministic `formatReviewFeedback(session)` used by both Save and Send. State whether `<kind>-review.md` is the feedback, the annotated artifact, or both. Reuse `formatReview` unless there is a stated reason not to.

### 2. [BLOCKER] The human verdict and the post-revise audit both vanish

*Lens: ux.* Phase 1 offers Save / Send / Discard and no terminal review action. Today the human verdict comes from the CLI's submit panel and is formatted as `**Verdict:** Approved|Comment` (`core/formatter.ts:16`); the revise response is parsed into `SpecReviewSummary {verdict, reviewerSummary, commentCount, appliedChanges, unresolvedComments}` (`src/shared/types.ts:113`) and rendered in `spec-tab.tsx`. The new `ReviewReviseResult` is `{revisedMarkdown}` (`:260`) and `spec-review-response-parser.ts` is slated for deletion (`:94`). Both directions regress, and the project's own approval gate ("spec is explicitly approved", `:388`; `AGENTS.md`) becomes unsatisfiable through the embedded UI.

**Decision needed:** Phase 1 keeps a submission state (`draft | changes_requested | approved`) plus reviewer summary on the way in, and keeps a structured revision report (at minimum the current `SpecReviewSummary`, ideally per-thread disposition) on the way out. Decide whether unresolved threads block approval.

### 3. [BLOCKER] The replace decision rests on an inaccurate comparison, and reuse was never evaluated

*Lenses: scope (also ux, arch).* The comparison table (`:34-47`) marks mermaid rendering and plan-outline TOC as absent from the CLI. They are not: `packages/cli/README.md:34,63` documents full markdown rendering with mermaid, KaTeX, footnotes and admonitions; `:57` documents exact line-range anchors; `:116-127` documents plan detection with milestone/task/dependency navigation; `:61,138` documents autosave and resume. The monorepo already ships `@plan-review/browser-app`, a three-panel review UI served over local HTTP by the CLI (`packages/cli/src/server/server.ts`). The spec never evaluates pointing an Electron `WebContentsView`/`<webview>` at that server, nor extracting reusable UI upstream, nor keeping the bridge. Only the text-quote-anchoring row of the table is fair — the CLI's line ranges are genuinely coarser than phrase anchoring.

**Decision needed:** correct the table, then make the build-vs-embed call explicitly (see *Recommendation on approach*). If a Forge-native rewrite still wins, say what reuse cannot deliver.

### 4. [MAJOR] Phase 1 is a net capability regression, gated by nothing

*Lenses: scope, ux.* Phase 1 ships section-only comments and mermaid-as-code-fence (`:73,80`) and then deletes the working bridge and its tests (`:90-98`). Against the CLI that is: line anchors lost, mermaid lost, KaTeX lost, resume semantics unproven. The only stated gain is location. **Decision needed:** either keep the bridge behind a flag until an explicit parity checklist passes, or pull line-range anchoring and mermaid display into Phase 1.

### 5. [MAJOR] The declared dependencies are not installable

*New finding, not raised by any lens.* The spec consumes `@plan-review/core ^0.1.0` and `@plan-review/react ^0.1.0` "from npm" (`:185`). Both return 404 on the registry; only `plan-review@1.1.6` (the CLI, already in `package.json`) is published. Separately, `@plan-review/react` exports exactly three hooks totalling ~50 lines (`packages/react/src/useAutosave.ts`), and Forge's used surface of core is `FileSessionStore` plus types. **Decision needed:** publish both packages as a prerequisite, or vendor the ~50 lines and drop the react dependency entirely; either way remove "from npm" until it is true.

### 6. [MAJOR] The revise pipeline is three new features, not a lift

*Lens: arch.* "Lift `reviseWithReview` into `review-revise.ts`" (`:77`) understates the work. Revise is not streamed today — `register.ts:121` passes `onChunk: () => undefined`. Triage has no review path at all: no handlers (`register.ts:142`), no review state in `triage-drawer.tsx`. Prompts, tags and parser are all spec-shaped. And the `review:revise-chunk/done/error` channels (`:229-231`) have no payload types, while every existing stream event carries `issueId` and `app.tsx:175` already guards against stale review completion after a drawer switch. **Decision needed:** split into named tasks (artifact-neutral prompts/parser, streamed revise with a `reviewRunId` + typed chunk/done/error payloads, brief revise, commit-into-tab), and decide whether Phase 1 streams at all or keeps today's await-the-result shape.

### 7. [MAJOR] Draft identity has no repo scope, no content hash, no stale policy

*Lenses: arch, ux.* Draft keys are `sha256(forge:<issueId>:<kind>)` (`:215`) while `repoPath` is mutable config (`config-store.ts`), so drafts collide across repos. Core's `SessionData` *requires* `contentHash` (`packages/core/src/session.ts:8`) and `ReviewClient.loadDocument` already returns `restoredSession.stale`; the spec stores neither and defers staleness to Phase 2 (`:111`). A regenerated spec will silently reload old comments against new content. **Decision needed:** key by repo identity + artifact path + kind, persist `baseContentHash` in Phase 1, and define load behaviour on mismatch (warn / read-only / discard).

### 8. [MAJOR] Autosave cannot satisfy its own "done when"

*Lenses: arch, ux.* "Drafts survive drawer close" (`:100`) with `useAutosaveSnapshot` + `useFlushOnUnload` (`:187`) — but `useAutosave`'s cleanup calls `autosave.cancel()` and `useFlushOnUnload` only listens to window `beforeunload` (`packages/react/src/useAutosave.ts:8,38`). A drawer close is an unmount, not an unload: the last debounced draft is dropped. Nothing is said about composer text, atomic writes, crash recovery, or the unexplained `overwrite?`/`exists?` fields (`:252-253`). **Decision needed:** await `flush()` on tab change / drawer close / issue change / discard (or hoist the hook above tab content), include composer text in the snapshot, and specify the discard and overwrite confirmations.

### 9. [MAJOR] Source of truth for the reviewed content is unresolved

*Lens: arch.* Phase 1 reads markdown from disk on tab open (`:72`), but today `spec-tab.tsx` hands the in-memory `content` straight to `onLaunchReview` and "Write to file" is a separate optional button. A freshly generated, unwritten spec would become unreviewable. **Decision needed:** carry markdown + hash in `ReviewArtifact` and use disk only for hydration, or require write-before-review and document the change.

### 10. [MAJOR] The renderer security baseline is stated wrongly, and Phase 1 already injects HTML

*Lenses: arch, scope.* `:365` claims "contextIsolation + sandbox both apply". `contextIsolation: true` and `nodeIntegration: false` hold, but `sandbox: false` (`src/main/index.ts:53`) and `src/renderer/index.html` has no CSP. This is a Phase-1 concern, not Phase-2: Phase 1 already `dangerouslySetInnerHTML`s model-generated markdown. Mermaid is also absent from both `package.json` and the spec's dependency list (`:355`). **Decision needed:** correct the premise, add a CSP, pin the DOMPurify config as a Phase-1 deliverable with adversarial fixtures, and decide separately whether sandbox can be enabled before mermaid lands.

### 11. [MAJOR] Phase 1 is architected for phases 3–5 that may never happen

*Lenses: scope (S5, S6).* Phase 1 carries placeholder rail tabs (`:74`), a reserved `plan` kind (`:250`), a reserved `structured?` flag (`:258`), an extraction lint rule for a hypothetical `@plan-review/react-ui` (`:208`), and a file tree drawn through Phase 5 (`:310-355`). The HTML-islands render model is chosen for Phase 3's needs. Forge's roadmap does include review (`thoughts/initial-thoughts.md:80-84` — feedback field plus Linear comment, plus the approval gate), so this is not off-roadmap, but phases 3–5 are unjustified against orchestration and packaging. **Decision needed:** cut the spec to Phase 1 + a backlog section with demand triggers; delete reserved kinds, flags, placeholder tabs and future file declarations.

### 12. [MAJOR] Review UI is forbidden from using Forge's design tokens

*Lens: ux.* `:341` says `tokens.css` holds "local CSS vars; do not pull from Forge tokens" and `:206` bans Forge utility imports, while the spec simultaneously argues Forge's theme is sufficient (`:379`). The predictable result is a visually foreign app inside the drawer. Accessibility (focus order and restoration, landmarks, keyboard thread/TOC navigation, live-region status, contrast, reduced motion) is unaddressed. **Decision needed:** mirror Forge semantic tokens through a single mapping file (extraction stays viable), and add a short Phase-1 a11y acceptance list.

### 13. [MAJOR] Three panes inside a 55%-width drawer

*Lens: arch.* App min-width is 1240px and the drawer is 55% (`src/renderer/styles/tokens.css`), so TOC + document + rail share roughly 682px at minimum size. **Decision needed:** pick one — collapsible TOC, overlay rail, or a full-window review mode. This also bears on issue 3, since the existing browser UI gets the whole window.

### 14. [MINOR] `markdown-it` will not pass HTML islands through by default

Phase 3's `<span data-decision>` / `<div data-suggestion>` markers (`:128`) require `markdownit({html: true})`; the default is `false`. Specify the option and the exact DOMPurify allowlist alongside issue 10.

### 15. [MINOR] Mermaid node anchors are inconsistent and label-derived

`:110` stores `{kind:'node', section, line, diagramId, nodeId, label}`; the type at `:266` omits `section`. The mockup derives the id by slugifying visible label text (`mermaid_block_v3.jsx:242`), so duplicate or renamed labels collide. Fix the type and prefer the source-level mermaid node id with label as fallback. Phase 2.

### 16. [MINOR] "Done when" criteria are happy paths, not a parity gate

No criterion covers markdown-construct parity, resume, cancellation, stale sessions, or error recovery; "all Phase-1 tests passing" is circular. `:157` also refers to "alvaro's comment" despite the single-user `you`/`agent` model. Add a short acceptance matrix naming which current capabilities may be dropped.

### 17. [MINOR] Empty, loading, failure and stale copy is unspecified

Only toolbar labels and "anchor stale" exist. Add a Phase-1 state/copy/actions table (empty rail, saving, saved, save failed, revise failed, overwrite, submit-with-no-comments).

### 18. [NIT] IPC constants should extend the existing registry

The spec proposes standalone `REVIEW_*` exports (`:223-241`); Forge keeps all channels as properties of the `IpcChannel` object with a derived `IpcChannelName` type. Add `ReviewLoadDraft` etc. to that object.

## Refuted or downgraded findings

- **"Performance claim has no envelope" (ux, MAJOR) — refuted for Phase 1–2.** Specs and briefs are kilobytes; the spec's claim holds. Re-raise when Phase 5 plans arrive.
- **"Electron sandboxing does not apply" (arch/scope) — partial.** `contextIsolation` is true and `nodeIntegration` false; only `sandbox: false` and the missing CSP are real. Folded into issue 10 with the correction.
- **"The subproject displaces Forge's roadmap" (scope, MAJOR) — partial.** Review is on the roadmap (`initial-thoughts.md:80-84`); only phases 3–5 are unjustified. Folded into issue 11.
- **"The CLI already has everything Phase 1 offers" (ux/scope) — partial.** The CLI has line-range, not phrase-level, anchoring; that table row is fair. Mermaid, plan TOC and resume rows are wrong.
- **"The companion packages genuinely exist" (arch, listed as a positive) — partial.** They exist in the monorepo but are unpublished; see issue 5.
- **"Mermaid mockup parity is untestable" (ux, MINOR) — accepted but deferred.** A Phase-2 concern; enumerate retained controls when Phase 2 is planned.

## Recommendation on approach

**Do not approve a five-phase Forge-native rewrite.** The stated pain is context-switching, not missing capability — and the tool being replaced already delivers more than Phase 1 would. The cheapest fix for the actual pain is to keep `plan-review` as the review engine and render its existing browser UI *inside* the Forge window: the CLI already serves `@plan-review/browser-app` over local HTTP (`packages/cli/src/server/server.ts`), so an Electron `WebContentsView` or `<webview>` pointed at that URL gets in-window review with line anchors, mermaid, KaTeX and resume intact, for days of work rather than weeks. The known cost is a small upstream change — the CLI's one-shot `--fresh -o file` flow needs a long-lived serve mode that returns the submission over HTTP instead of exiting — plus a decision on issue 13, since a three-panel UI wants more than 682px either way.

Importing `@plan-review/browser-app` as components is *not* a viable middle path: it is Preact + `marked`, private, and would need `preact/compat` inside a React 18 renderer. Embed it as a page, not as a component tree.

The genuinely new capability in the `plan-review-2` design — decisions, suggestion diffs, node-anchored mermaid threads, drafted replies — is real and worth building, but it belongs **in the plan-review monorepo**, where core, browser-app, the CLI and the VS Code extension already share one implementation of parsing, anchoring and submission. Forking it into Forge creates a second renderer and anchoring system and orphans the other two consumers. Forge should own integration only: artifact selection, issue context, model config, revise streaming into the Spec/Brief tab, approval state, Linear writeback.

Concretely: replace this spec with a Phase 0 spike (embed the existing UI in a Forge-owned view; measure whether the context-switch complaint is gone), keep the bridge until that spike reports, and open a separate spec against `plan-review` for the HITL design. If the spike fails on grounds reuse cannot fix, come back to a Forge-native Phase 1 — with issues 1, 2, 5–10 resolved first.

## Verification log

| # | Lens | Finding | Status |
|---|---|---|---|
| A1 | arch | Phase 1 never defines what a saved review contains | CONFIRMED — `:75` vs `:194`; core `ReviewSubmission`/`formatReview` unused → issue 1 |
| A2 | arch | Disk-only loading regresses unsaved-spec review | CONFIRMED — `spec-tab.tsx` passes in-memory content → issue 9 |
| A3 | arch | "Lift and generalize" misses streaming + triage | CONFIRMED — `register.ts:121` discards chunks; no triage review path → issue 6 |
| A4 | arch | Autosave hooks do not persist on drawer close | CONFIRMED — cleanup calls `cancel()`; flush is `beforeunload`-only → issue 8 |
| A5 | arch | Draft identity and stale-source handling incomplete | CONFIRMED — no repo scope, no `contentHash` → issue 7 |
| A6 | arch | Revise IPC has channel names, no event contract | CONFIRMED — no payload types, no run correlation → issue 6 |
| A7 | arch | Mermaid security assumptions do not match Forge | CONFIRMED with correction — `sandbox:false`, no CSP; contextIsolation is on → issue 10 |
| A8 | arch | markdown-it will not pass HTML islands through | CONFIRMED — default `html:false` → issue 14 |
| A9 | arch | Three-pane layout vs actual drawer width | CONFIRMED — ~682px at min width → issue 13 (upgraded to major) |
| A10 | arch | IPC constants should extend `IpcChannel` | CONFIRMED — nit → issue 18 |
| S1 | scope | Replacement rests on an inaccurate comparison; alternatives omitted | CONFIRMED — CLI README contradicts table rows → issue 3 |
| S2 | scope | Phase 1 is a regression, not the smallest slice | CONFIRMED → issue 4 |
| S3 | scope | Creates a second renderer/anchoring/session implementation | CONFIRMED → issues 3 and 11, and the approach recommendation |
| S4 | scope | Comments never become saved or revision-ready feedback | CONFIRMED — duplicate of A1 → issue 1 |
| S5 | scope | Later-phase ambitions bloat Phase 1 | CONFIRMED → issue 11 |
| S6 | scope | Subproject displaces Forge's roadmap | PARTIAL — review is on the roadmap; phases 3–5 are not → issue 11 |
| S7 | scope | Open questions presented as decisions; security premise wrong | CONFIRMED → issues 10 and 11 |
| S8 | scope | Success criteria cannot establish a safe replacement | CONFIRMED — minor → issue 16 |
| U1 | ux | Review state never becomes agent-consumable feedback | CONFIRMED — duplicate of A1 → issue 1 |
| U2 | ux | The artifact approval/rejection transition disappears | CONFIRMED — core verdict + `SpecReviewSummary` both dropped → issue 2 |
| U3 | ux | Phase 1 is a capability regression from the CLI | CONFIRMED, one row overstated (line-range ≠ quote anchoring) → issue 4 |
| U4 | ux | No thread, reply, or reviewer-intent model | CONFIRMED — core `ReviewComment` has none; spec adds none → issue 1 |
| U5 | ux | Stale-anchor handling starts too late; no artifact identity | CONFIRMED → issue 7 |
| U6 | ux | Mermaid node anchors contradictory and unstable | CONFIRMED — `:110` vs `:266`; label slugification → issue 15 (minor) |
| U7 | ux | The existing revise audit result is dropped | CONFIRMED — `ReviewReviseResult` is markdown only → issue 2 |
| U8 | ux | Autosave, discard, overwrite, crash semantics incomplete | CONFIRMED → issue 8 |
| U9 | ux | Accessibility, keyboard workflow and theming absent | CONFIRMED — "do not pull from Forge tokens" is the sharpest part → issue 12 |
| U10 | ux | Performance claim has no envelope | REFUTED for Phase 1–2; revisit at Phase 5 |
| U11 | ux | Mermaid mockup parity implied, not testable | CONFIRMED — deferred to Phase 2 planning |
| U12 | ux | User-facing copy and error states unspecified | CONFIRMED — minor → issue 17 |
| U13 | ux | Render/save pipeline contradicts itself | CONFIRMED — `:18` vs `:194` → issue 1 |
| — | opus | `@plan-review/core` and `/react` are not published to npm | NEW — both 404; only `plan-review@1.1.6` exists → issue 5 |
