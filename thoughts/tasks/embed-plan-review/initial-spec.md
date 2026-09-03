# Spec: embed-plan-review — Embedded review experience inside Forge drawers

> **Status:** Draft v3 (post-design, HTML render pipeline)
> **Generated:** 2026-05-22
> **Branch:** TBD (off latest stable)
> **Supersedes:** initial-spec.md v1 (paused awaiting design files)
> **Design source:** `resources/design/plan-review-2/plan-review/project/Plan Review HITL.html` (+ `app_hitl.jsx`, `comments_v3.jsx`, `mermaid_block_v3.jsx`, `styles_v3.css`, `styles_hitl.css`)
> **Companion package work:** `~/desenv/personal/plan-review/` — `@plan-review/core` + `@plan-review/react` (consumed from npm)

---

## Task Summary

Replace Forge's CLI shell-out for plan-review (`spec-review-bridge.ts` + sibling modules) with an embedded review experience that lives inside the Forge window as a **Review** tab in `SpecDrawer` and `TriageDrawer`. The new design from `plan-review-2` is substantially richer than the original `spec-review` CLI: text-quote anchoring, mermaid blocks with node-anchored threads, structured decisions, inline AI-suggestion diffs, citations, activity log, AI-drafted replies. Ship it incrementally — each phase removes pain or adds capability on its own.

**Persona note.** The design uses a named AI persona ("Mira") and multi-author avatars. Forge is single-user. Strip the persona and multi-author scaffolding. Where the design says "Mira", call it "Agent" or omit. Multi-author colors are unused — author is always `you` or `agent`. Functionality first, polish later.

**Render pipeline note.** Reviewable artifacts (spec / brief / plan) stay **markdown on disk** — generators unchanged, repo-grep unchanged, git diffs stay readable. Inside the Review tab, markdown is converted to **HTML in memory** at load time, and the HTML tree is what we anchor decisions / suggestions / mermaid blocks / quote highlights against. Save flow does HTML→markdown for the reviewable; the saved review file is markdown with HTML islands embedded for elements that can't round-trip (mermaid, decision blocks, suggestion diffs). A later phase adds a "Print HTML" button that dumps the fully-rendered HTML as an export artifact. Performance is a non-issue — artifacts are kilobytes, `marked`/`markdown-it` parses in single-digit ms, parsed HTML cached in renderer state for the drawer lifetime.

---

## Context

### What exists today
- `src/main/services/spec-review-bridge.ts` spawns the external `plan-review` CLI as a child process, hands it a spec markdown, waits for the user to finish reviewing in the browser UI, parses the resulting review markdown back, and surfaces it in Forge.
- `src/main/services/spec-review-revision.ts` + `spec-review-revision-prompt.ts` + `spec-review-response-parser.ts` already implement the "send review back to Claude, get revised spec" pipeline.
- Renderer has a button somewhere in `spec-drawer.tsx` (and parallel for triage) that triggers the CLI flow.

### Why replace
- Context-switching cost: the browser CLI UI is detached from the issue context (Linear ticket, repo, sibling artifacts).
- The CLI cannot evolve quickly because it is a separate distributable.
- The new design pulls in capabilities the CLI cannot easily deliver: mermaid awareness, structured decisions, suggestion diffs.

### What the new design adds (vs. the original CLI)
| Feature | CLI today | Design |
|---|---|---|
| Section-anchored comments | ✓ | ✓ |
| Text-quote anchoring (highlight specific phrase) | ✗ | ✓ |
| Mermaid diagram rendering | ✗ | ✓ |
| Node-anchored threads (click a diagram node to comment) | ✗ | ✓ |
| Structured decisions w/ option picker | ✗ | ✓ |
| Inline AI suggestion diffs (accept/reject) | ✗ (free-form revise only) | ✓ |
| Citations w/ source popovers | ✗ | ✓ |
| Activity timeline | ✗ | ✓ |
| Drafted-reply HITL flow | ✗ | ✓ |
| Plan-outline TOC (milestones/tasks) | ✗ | ✓ |
| Linear writeback of comments | ✗ | (still ✗ — out of scope) |

---

## Phasing strategy

Five phases. Each is shippable and adds substantial value on its own. Stop after any phase if priorities shift — no half-built features left dangling.

```
Phase 1: Embedded review MVP            ← removes CLI dependency
Phase 2: Rich anchoring (quote + mermaid + nodes)
Phase 3: Structured decisions + inline suggestion diffs
Phase 4: Citations + activity log + drafted replies
Phase 5: Plan-outline TOC + Linear writeback
```

---

## Phase 1 — Embedded review MVP (replace the CLI shell-out)

**Goal.** No more child-process shell-out. Reviewing a spec or triage brief happens inside the drawer.

**Scope.**
- New `Review` tab in `SpecDrawer` and `TriageDrawer` next to existing Spec/Brief tabs.
- Three-pane layout inside the Review tab: TOC (sections of the artifact) | rendered doc | comment rail.
- **md→HTML render pipeline.** On Review-tab open, read markdown from `thoughts/tasks/<id>/initial-spec.md` (or `triage-brief.md`), parse to HTML via `markdown-it` + DOMPurify, inject `data-section` + `data-line` attributes on block-level nodes during parse (custom plugin walks token stream). Cache HTML in renderer state. Re-parse only on revise-stream completion.
- Comment granularity: **section-only**. Click a section heading or its body → composer opens → comment attached to that section. No text-quote anchoring yet (Phase 2).
- Comment rail tabs: just `Comments` (no Decisions/Activity tabs yet — placeholders).
- Actions: **Save to File** (writes `thoughts/tasks/<id>/<kind>-review.md` — markdown w/ HTML islands for unconvertible elements; Phase 1 has none, so pure markdown), **Send to Claude** (revise pipeline streams revised markdown back into the Spec/Brief tab; renderer re-parses md→HTML), **Discard** (clears draft).
- Autosave drafts to `~/.forge/review-drafts/<sha256(forge:<issueId>:<kind>).slice(0,16)>.json` via core's `FileSessionStore`. Draft stores comments keyed by `{section, line}` only — not by DOM node id (DOM ids are render-time, not stable).
- Revise pipeline: lift `reviseWithReview` out of `spec-review-bridge.ts` into artifact-agnostic `src/main/services/review-revise.ts`; kind-keyed system prompts in `src/main/services/review-prompts.ts`.

**Out of scope for Phase 1.**
- Mermaid rendering. Mermaid code blocks render as plain ```mermaid``` code blocks for now.
- Text-quote highlighting / DOM selection.
- Structured decisions, suggestion diffs, citations, activity log, drafted replies.
- Linear writeback.
- Diff view of revised artifact (Send-to-Claude replaces tab content; no inline diff).
- Plan as a reviewable artifact (plan-generation feature not yet built).

**Deliverables.**
- Tab visible in both drawers.
- End-to-end loop: open issue → Review tab → add section comments → Save to File → see file on disk → Send to Claude → revised spec streams into Spec tab.
- All Phase-1 tests passing; old `spec-review-bridge.ts` + its IPC channels + its renderer button **deleted**.

**Removals at end of Phase 1.**
- `src/main/services/spec-review-bridge.ts`
- `src/main/services/spec-review-response-parser.ts` (if unused after lift)
- `src/main/services/spec-review-tags.ts` (if CLI-specific)
- IPC channels driving the CLI shell-out (locate during impl).
- Renderer button(s) that triggered the CLI flow.
- All tests around the above (rewrite under new locations).

**Done when.** Reviewing a spec or brief never spawns an external CLI. Drafts survive drawer close. Saved review markdown lands at the documented path.

---

## Phase 2 — Rich anchoring (text-quote + mermaid + node)

**Goal.** Comments can pin to a specific phrase or a specific mermaid node, not just a section.

**Scope.**
- **Text-quote anchoring.** User selects text in the rendered HTML doc → composer opens with selected quote → comment stored as `{anchor: {kind: 'quote', section, line, quote}}`. On every render, post-parse pass walks the HTML, finds the quote text inside the matching section's DOM subtree via TreeWalker (mirrors `app_hitl.jsx` lines 571–590), wraps it in `<span class="comment-range" data-thread-id=…>`. If not found (stale), fall back to whole-section highlight + visible "anchor stale" indicator in the rail.
- **Mermaid rendering.** `MermaidBlock` component (port from `mermaid_block_v3.jsx`). markdown-it plugin detects ```mermaid``` fences and emits `<div class="mermaid-block" data-source="…">` placeholders; renderer replaces them with React-mounted `MermaidBlock` after HTML inject. Mermaid renders source to SVG in renderer. Click a node → composer opens → comment stored as `{anchor: {kind: 'node', section, line, diagramId, nodeId, label}}`. Pins overlay diagram showing thread count per node.
- **Anchor-staleness handling.** Both quote and node anchors best-effort. Show staleness when source changes invalidate them. No auto-reanchoring magic — clear UI only.
- **Highlight overlays.** Inline `<span class="comment-range">` wraps anchored text; clicking focuses rail thread. Resolved threads dim highlight.

**Out of scope.**
- Multi-quote per comment.
- Line-number-precise anchoring (we anchor by quote text within a section, not by absolute line number, because revise rewrites lines).
- Selection across paragraphs.

**Done when.** A user can comment on the word "PKCE" inside paragraph X, the highlight survives a Send-to-Claude round-trip iff that word still appears in that section, and node-anchored mermaid threads work end-to-end.

---

## Phase 3 — Structured decisions + inline suggestion diffs

**Goal.** The artifact can declare decisions the human must resolve, and the agent can propose specific inline edits the human accepts/rejects.

**Scope.**
- **Decision markers in markdown.** Since reviewable stays markdown on disk but renders as HTML, use HTML islands directly in the markdown: `<span data-decision="d1">…wrapped phrase…</span>` plus a trailing fenced ```json decisions``` block carrying `{id, question, context, options: [{key, text, recommended?, custom?}]}`. markdown-it passes HTML through; renderer parses the decisions block out of HTML, removes it from displayed doc, mounts `DecisionMarker` React components on the spans. HTML→md save preserves both verbatim.
- **Decisions rail tab.** Lists open + resolved decisions. Clicking an option resolves the decision (writes back to the draft). "Tell me a different option…" opens a free-form composer. **No "Approve all recommended" bulk action in Phase 3** — defer to Phase 5 polish.
- **Inline suggestion diffs.** Revise pipeline emits, alongside revised markdown, structured suggestions: `{id, anchor, title, rationale, kind: 'replace'|'insert'|'delete', before, after, conf}`. Embedded in markdown as `<div data-suggestion="s1"></div>` placeholders + trailing fenced ```json suggestions``` block. Renderer mounts `Suggestion` cards at placeholders. Accept = mutate in-memory draft markdown (suggestion JSON updated w/ `state:'accepted'`, placeholder replaced by `after` content on save). Reject = mark `state:'rejected'`, placeholder removed on save. Discuss = opens composer producing comment on suggestion's anchor.
- **Prompt changes.** `review-prompts.ts` gains an optional structured-output mode that asks Claude to return JSON with `{revisedMarkdown, suggestions[], decisions[]}` rather than just bulk markdown. Old free-form revise remains as fallback when JSON parse fails.

**Out of scope.**
- AI-generated decisions from the spec generator itself (only the revise step emits them).
- Multi-step decisions (e.g. decision B depends on decision A).
- Persistent decision history across multiple revise rounds.

**Done when.** A revise round can return 2 decisions + 3 suggestions; user picks options + accepts/rejects suggestions in-place; final saved review reflects the resolutions.

---

## Phase 4 — Citations + activity log + drafted replies

**Goal.** The agent's reasoning is auditable, and the agent can propose replies to specific human comments for HITL approval.

**Scope.**
- **Citations.** Revise pipeline output includes a `citations: {[n]: {ref, src, snippet}}` block. Renderer wraps inline `[n]` markers as hover-popover footnotes (port from `Cite` + `CitePopover`). Sources: linear, file, rfc, doc, incident — extensible.
- **Activity timeline.** New `Activity` rail tab. Records: spec drafted, revise round started/finished, decisions flagged, suggestions drafted, user resolved comment, draft-reply created. Persisted in the same draft file as the comments.
- **AI-drafted replies.** A `Draft reply` button on each open comment thread calls Claude with the thread + surrounding context; Claude returns a draft. UI shows the draft inline with **Edit / Discard / Send as you** controls. Sending it appends the (user-attributed) reply to the thread. No reply is ever sent without explicit human action.
- **Tweaks panel.** Minimal: just `Auto-draft replies on/off`. Theme + agent-tone are out of scope (theme already global in Forge; tone is persona-flavor).

**Out of scope.**
- Citation editing (citations are read-only artifacts from the agent).
- Auto-generated draft replies for every new comment without explicit user request.
- Activity log persistence beyond the current draft (no cross-session history view).

**Done when.** A user can ask the agent to draft a reply to alvaro's comment, review the draft, edit it, and send it as their own — all without leaving the rail.

---

## Phase 5 — Plan-outline TOC + Linear writeback (+ polish)

**Goal.** The reviewer scales beyond a single spec — it understands plans (milestones + tasks) and pushes resolved threads back to Linear.

**Scope.**
- **Plan-outline TOC.** When reviewable is a plan (not spec/brief), render left pane as milestone/task hierarchy from `app_hitl.jsx`'s `TOC` component. Task states: `approved`, `needs-input`, `drafted`, `queued`. Click task → swap doc + rail to that task's review state. Gated on plan-generation feature.
- **Linear writeback.** Optional "Push to Linear" action posts each resolved thread (or all comments) as single comment on originating Linear issue. Uses Linear skill at `.agents/skills/linear/`. Confirmation modal lists exactly what will be sent.
- **Print HTML export.** Button in Review tab toolbar: dumps current rendered HTML (mermaid SVG inlined, decisions resolved, suggestions applied, comments stripped) to `thoughts/tasks/<id>/<kind>-review.html`. One-way export — not reloadable. Useful for sharing fully-styled review w/o running Forge.
- **Polish.** "Approve all recommended" bulk action for decisions. Anchor-staleness recovery suggestions ("did you mean: …?"). Filter rail by `Open / All / Mine / Resolved` (from `RailFilters`).

**Out of scope.**
- Multi-task review in a single drawer instance (each task review is its own drawer state).
- Linear thread sync (writes only, no reads — Linear comments stay in Linear).
- Plan generation itself (separate feature).

**Done when.** A multi-task plan can be reviewed task-by-task, and the resolved review can be one-click published as a Linear comment.

---

## Cross-phase technical decisions

These hold across all phases unless a phase explicitly revisits one.

### Library boundary
- Forge consumes `@plan-review/core` ^0.1.0 and `@plan-review/react` ^0.1.0 from npm (delivered by the parallel core refactor).
- From core: `types` (incl. `LineAnchor`, `SessionData`, `ReviewComment`), `FileSessionStore`, `SessionStore` interface, `createAutosave`. **`parser` + `formatter` not used by Forge's renderer** — we use `markdown-it` for md→HTML and a custom HTML→md serializer for save. Core's parser may still be used by main-process services if needed for line-mapping utilities.
- From react: `useAutosave`, `useAutosaveSnapshot`, `useFlushOnUnload`.
- **UI components live in Forge.** Packages export no UI.

### Render pipeline (md ↔ HTML)
- **Load**: read md from disk → `markdown-it` parse with custom plugin emitting `data-section` (slugified heading) + `data-line` (source-line number) on every block-level node → DOMPurify sanitize (allow `data-*`, `<span data-decision>`, `<div data-suggestion>`, `<div class="mermaid-block">`) → assign to `dangerouslySetInnerHTML` on `<article ref={docRef}>`.
- **Post-parse pass** (useLayoutEffect, after each render): walk DOM, inject comment-range highlights for quote anchors, mount React portals for mermaid placeholders, mount `DecisionMarker` on `[data-decision]` spans, mount `Suggestion` cards on `[data-suggestion]` divs.
- **Revise**: streamed markdown replaces in-memory source; re-run load step.
- **Save**: serialize current in-memory markdown source (which already contains accepted-suggestion mutations + decision-resolution updates applied as text edits) to `thoughts/tasks/<id>/<kind>-review.md`. No HTML→md conversion needed for Phase 1–2; Phase 3+ mutations apply to source markdown directly, not to the rendered DOM.
- **Print HTML** (Phase 5): serialize current rendered HTML to a standalone `.html` file with inlined CSS + mermaid SVGs.

### Anchor model
- Comments persist with `{section, line}` plus kind-specific extras. `line` comes from the markdown source (the `data-line` attr we injected at parse).
- Phase 1: `{kind: 'section', line, section}`.
- Phase 2: `{kind: 'quote', line, section, quote}`, `{kind: 'node', line, section, diagramId, nodeId, label}`.
- Re-anchor on every parse: match by `quote` / `nodeId` inside section subtree; fall back to section-only; mark stale if section itself vanished.
- Compatible w/ core's `LineAnchor` (just a line number); extras live in a sidecar field on `ReviewComment`.

### UI ownership (extraction discipline)
- All review components live under `src/renderer/components/review/`.
- Components are pure: props in, callbacks out. No IPC, no Forge tokens, no Forge utility imports.
- All Forge glue (IPC, autosave wiring, draft loading, revise stream subscription) lives in `src/renderer/hooks/use-review.ts`.
- Lint rule: no relative imports from inside `review/` going above `review/`. Mechanical extraction to `@plan-review/react-ui` stays viable.

### Process split (Electron)
- **Renderer owns:** md→HTML via `markdown-it` + DOMPurify, holding comment + decision + suggestion state, rendering UI, debouncing autosave via react hooks, mermaid rendering (mermaid runs in renderer), HTML export (Phase 5).
- **Main owns:** `FileSessionStore` writes to `~/.forge/review-drafts/`, file I/O for saved review markdown + HTML export, Claude spawn for revise + draft-reply.

### Disk layout
- Drafts: `~/.forge/review-drafts/<sha256(forge:<issueId>:<kind>).slice(0,16)>.json`. Uses `FileSessionStore` with `dir = ~/.forge/review-drafts/`. Add `reviewDraftsDir()` to `src/main/lib/paths.ts`.
- Saved review markdown: `thoughts/tasks/<issueId>/<kind>-review.md`.

### IPC contracts (Phase 1 baseline, expanded per phase)

`src/shared/ipc-channels.ts`:

```ts
// Phase 1
export const REVIEW_LOAD_DRAFT  = 'review:load-draft';
export const REVIEW_SAVE_DRAFT  = 'review:save-draft';
export const REVIEW_CLEAR_DRAFT = 'review:clear-draft';
export const REVIEW_SAVE_FINAL  = 'review:save-final';
export const REVIEW_REVISE      = 'review:revise';
export const REVIEW_REVISE_CHUNK = 'review:revise-chunk';
export const REVIEW_REVISE_DONE  = 'review:revise-done';
export const REVIEW_REVISE_ERROR = 'review:revise-error';

// Phase 4
export const REVIEW_DRAFT_REPLY        = 'review:draft-reply';
export const REVIEW_DRAFT_REPLY_CHUNK  = 'review:draft-reply-chunk';
export const REVIEW_DRAFT_REPLY_DONE   = 'review:draft-reply-done';
export const REVIEW_DRAFT_REPLY_ERROR  = 'review:draft-reply-error';

// Phase 5
export const REVIEW_PUSH_TO_LINEAR     = 'review:push-to-linear';
export const REVIEW_EXPORT_HTML        = 'review:export-html';
```

Preload bridge `window.forge.review` mirrors the channels as a typed namespace. Stream handlers return unsubscribe functions.

### Shared types (additions to `src/shared/types.ts`, expanded per phase)

```ts
// Phase 1
export type ReviewableKind = 'spec' | 'brief' | 'plan'; // plan reserved for Phase 5
export interface ReviewArtifact { issueId: string; kind: ReviewableKind; }
export interface ReviewSaveInput extends ReviewArtifact { markdown: string; overwrite?: boolean; }
export interface ReviewSaveResult { written: boolean; path: string; exists?: boolean; }
export interface ReviewReviseInput extends ReviewArtifact {
  originalMarkdown: string;
  reviewFeedback: string;
  model: string;
  structured?: boolean; // Phase 3
}
export interface ReviewReviseResult { revisedMarkdown: string; }

// Phase 2
export type ReviewAnchor =
  | { kind: 'section'; line: number; section: string }
  | { kind: 'quote';   line: number; section: string; quote: string }
  | { kind: 'node';    line: number; diagramId: string; nodeId: string; label: string };

// Phase 3
export interface ReviewDecision {
  id: string;
  anchor: ReviewAnchor;
  question: string;
  context?: string;
  options: { key: string; text: string; recommended?: boolean; custom?: boolean }[];
  resolved: boolean;
  decidedAs?: string;
}
export interface ReviewSuggestion {
  id: string;
  anchor: ReviewAnchor;
  title: string;
  rationale: string;
  kind: 'replace' | 'insert' | 'delete';
  before?: string;
  after?: string;
  conf?: string;
  state?: 'accepted' | 'rejected';
}

// Phase 4
export interface ReviewCitation { ref: string; src: 'linear'|'file'|'rfc'|'doc'|'incident'; snippet: string; }
export interface ReviewActivityItem {
  ts: number;
  kind: 'agent' | 'you' | 'system';
  what: 'agent-draft' | 'flagged' | 'suggestion' | 'reply-draft' | 'shared' | 'resolved';
  body: string;
  sources?: { k: string; label: string }[];
}
export interface ReviewDraftReplyInput extends ReviewArtifact {
  threadId: string;
  threadContext: string;
  model: string;
}
```

### Revise prompts

`src/main/services/review-prompts.ts` keys system prompts by `kind`. Phase 1: free-form markdown revise (spec + brief). Phase 3: optional structured mode keyed off `structured: true` in input — prompt asks for `{revisedMarkdown, suggestions[], decisions[], citations?}` JSON. Phase 4: separate `draftReply(kind, threadContext)` prompt.

### File structure

```
src/main/
├── services/
│   ├── review-store.ts          # wraps FileSessionStore w/ key namespacing
│   ├── review-writer.ts         # writes thoughts/tasks/<id>/<kind>-review.md
│   ├── review-revise.ts         # artifact-agnostic revise (lifted from spec-review-bridge)
│   ├── review-prompts.ts        # kind-keyed system prompts
│   └── review-draft-reply.ts    # Phase 4
├── ipc/
│   └── review.ts                # registers review:* handlers
└── lib/paths.ts                 # add reviewDraftsDir()

src/renderer/
├── hooks/
│   └── use-review.ts            # state machine + IPC glue
└── components/review/
    ├── review-panel.tsx         # three-pane layout
    ├── review-toc.tsx           # left pane (sections or milestones)
    ├── review-doc.tsx           # rendered artifact (md → HTML w/ anchor injection)
    ├── review-rail.tsx          # right pane w/ tabs
    ├── review-comments.tsx      # comments tab content
    ├── review-decisions.tsx     # Phase 3
    ├── review-activity.tsx      # Phase 4
    ├── thread-card.tsx
    ├── composer.tsx
    ├── mermaid-block.tsx        # Phase 2
    ├── decision-marker.tsx      # Phase 3
    ├── suggestion-card.tsx      # Phase 3
    ├── citation.tsx             # Phase 4
    ├── tokens.css               # local CSS vars; do not pull from Forge tokens
    └── md/
        ├── md-to-html.ts        # markdown-it instance + section/line plugin + DOMPurify config
        ├── inject-anchors.ts    # post-parse DOM walker for quote/decision/suggestion mounts
        └── html-export.ts       # Phase 5 standalone HTML serializer

Modified:
├── src/shared/types.ts                       # ReviewableKind, anchors, decisions, suggestions
├── src/shared/ipc-channels.ts                # REVIEW_* constants
├── src/shared/forge-api.ts                   # review.* namespace
├── src/main/preload.ts                       # bridge review.* channels
├── src/main/ipc/register.ts                  # wire review handlers
├── src/renderer/components/spec-drawer.tsx   # add "Review" tab
├── src/renderer/components/triage-drawer.tsx # add "Review" tab
└── package.json                              # add @plan-review/core + @plan-review/react + markdown-it + dompurify
```

---

## Open Questions

1. **markdown-it vs marked vs remark** (Phase 1). markdown-it picked in strawman for its plugin API (easy `data-line` injection) + speed. Lock during Phase 1 planning.
2. **Decision/suggestion markers as inline HTML** (Phase 3). Spec uses `<span data-decision="d1">` + trailing ```json decisions``` block. Risks: generator must emit valid HTML inside markdown; round-tripping HTML through markdown-it preserves it but DOMPurify must allowlist these attrs. Verify w/ small prototype before Phase 3.
3. **Suggestion application semantics** (Phase 3). Accept = mutate in-memory markdown source immediately, vs hold as pending overlay until save. Lean immediate-mutate since source is single source of truth and undo = re-load.
4. **Mermaid security** (Phase 2). Mermaid runs in renderer context. Confirm Forge CSP allows it without weakening — Electron's contextIsolation + sandbox both apply. Verify before Phase 2 starts.
5. **Plan-outline data source** (Phase 5). Where do milestones + tasks come from? Frontmatter in plan markdown? Sidecar `<plan-slug>.outline.json`? Out of scope until plan-generation lands but worth flagging.
6. **Linear writeback formatting** (Phase 5). One comment per resolved thread, vs single rolled-up comment with all resolutions? Lean rolled-up — Linear comments get noisy fast.
7. **Print HTML scope** (Phase 5). Standalone single-file `.html` (inline CSS + base64 SVGs)? Or directory w/ assets? Lean single-file for shareability.

---

## Out of scope (all phases)

- **Plan generation feature** itself — a separate effort. Review of plans is gated on it (Phase 5).
- **Real-time multi-user review** — single user, single machine.
- **Multi-artifact concurrent review** — one drawer, one review at a time.
- **Linear thread sync** (read direction) — writes only.
- **Mira / agent persona styling** — keep agent neutral, no "AI personality" branding.
- **Theme + tone toggles** from the design's tweaks panel — Forge's existing theme is enough; tone is persona polish.
- **Multi-author rail** — Forge is single-user; author is always `you` or `agent`.

---

## Approval gate

Before any implementation work begins:
1. User reviews this spec (e.g. via plan-review on it).
2. Spec is explicitly approved.
3. User picks a phase to plan first (default: Phase 1).
4. Run `superpowers:writing-plans` for that single phase, producing `thoughts/tasks/embed-plan-review/plans/<plan-slug>.md`.
5. Approve plan, then execute.

Do not generate plans for multiple phases at once — each phase's plan should be informed by what was learned in the previous one.
