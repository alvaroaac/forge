# Spec: embed-plan-review — In-window plan-review inside Forge

> **Status:** Approved (2026-09-02, v4 — embed existing plan-review browser-app)
> **Generated:** 2026-09-02
> **Draft:** v4 — supersedes v3 (2026-05-22)
> **Review that forced the rewrite:** `thoughts/tasks/embed-plan-review/spec-review.md` (BLOCK: 3 blockers, 10 majors)
> **Companion repo:** `~/desenv/personal/plan-review` (upstream changes listed below)

## Changes from v3

v3 proposed a five-phase Forge-native rewrite of plan-review: own markdown→HTML pipeline, own anchoring, own comment model, own draft store, own review UI. The review blocked it — the central data contract was undefined, the human verdict disappeared, and the build-vs-reuse decision rested on a comparison table that was factually wrong about the tool being replaced.

v4 accepts the review's recommendation. Forge does not reimplement plan-review. It embeds the existing browser UI in-window, keeps the existing round-trip contract byte-for-byte, and owns integration only. The new HITL design in `resources/design/plan-review-2/` is not cancelled — it moves to the plan-review monorepo, where core, browser-app, the CLI and the VS Code extension already share one parsing/anchoring/submission implementation. Forge phases 2+ are headings only; they are deliberately not designed here.

---

## Task Summary

Reviewing a Forge-generated spec today means leaving the app: `spec-review-bridge.ts` spawns the `plan-review` CLI, which opens the system browser and hands the review back as a file. The pain is the context switch, not missing capability — the CLI already delivers line-anchored comments, full markdown with mermaid and KaTeX, plan-outline navigation, autosave and resume. Phase 1 removes the context switch and nothing else: Forge starts the same CLI, points an Electron `WebContentsView` at the local HTTP server it already runs, and consumes the same output file it consumes today. The approval gate, `reviseWithReview`, `SpecReviewSummary` and every renderer path downstream stay exactly as they are.

---

## Context

### What exists today

- `src/main/services/spec-review-bridge.ts` — `launchSpecReview()` cleans the spec with `cleanSpecMarkdown`, writes it to a temp `review-input.md`, spawns `plan-review <input> --fresh --split-by heading -o file --output-file <output>` (`planReviewArgs`), waits for exit 0, reads the output file as `reviewFeedback`, and calls `reviseWithReview`.
- `src/main/services/spec-review-revision.ts` → `spec-review-revision-prompt.ts` → `spec-review-response-parser.ts` produce `SpecReviewResult { content, summary: SpecReviewSummary }` (`src/shared/types.ts`).
- IPC: `IpcChannel.SpecLaunchReview` (`spec:launch-review`), handler in `src/main/ipc/spec.ts`, wired in `src/main/ipc/register.ts`.
- Renderer: `spec-tab.tsx` "Launch Review" passes in-memory `content` to `onLaunchReview`; `app.tsx` guards stale completions with `activeReviewIssueId` / `currentDrawerIssueId` and sets `reviewedContent` + `reviewSummary`.
- Triage has no review path at all today — no handler, no state in `triage-drawer.tsx`.

### What plan-review already provides

`runBrowserReview` (`packages/cli/src/browser-review.ts`) boots an `HttpTransport` on an ephemeral port, prints `Review server running at <url>` to stderr, `spawnSync`s the OS opener, and resolves when the browser posts a submission. The server (`packages/cli/src/server/routes.ts`) exposes `GET /`, `GET /api/doc`, `POST /api/review`, `PUT /api/session`, `POST /api/heartbeat`, `POST /api/pause`, `POST /api/cancel`, and `GET /_assets/*`. `@plan-review/browser-app` (Preact) drives it: 5s heartbeats while visible, pause on hidden, `sendBeacon('/api/cancel')` on unload, autosave via `PUT /api/session`, verdict + summary via `SubmitReviewPanel`. On submit the CLI runs `formatReview(doc, {verdict, summary})` and writes it to `--output-file`, then exits 0.

Mermaid and KaTeX lazy-load from jsdelivr inside that page; offline they degrade to plain source. That is upstream behaviour and stays upstream behaviour.

### Why embed rather than rebuild

Everything Forge's v3 Phase 1 would have built exists and is better. Rebuilding creates a second renderer, a second anchoring model and a second session store, and orphans the CLI and the VS Code extension. Embedding is days, not weeks, and loses no capability. `@plan-review/browser-app` cannot be imported as components — it is private, Preact, and would need `preact/compat` inside Forge's React 18 renderer. Embed it as a page, not a component tree.

---

## Suggested Approach

### Phase 1 — in-window review (the whole of this spec)

1. **Dedicated review surface, not a drawer pane.** On "Launch Review", main creates a `WebContentsView` sized to the window content area below the topbar and adds it to the window's content view. The drawer stays mounted underneath; Forge's topbar stays visible above with a "Close review" affordance. Escape closes it.
2. **Launch.** Keep `launchSpecReview`'s temp-file input and argv exactly as today, adding `--no-open` and `--print-url` (see upstream). Main reads the announced URL from the CLI's stdout and loads it into the view.
3. **Close / cancel.** Closing the surface POSTs `/api/cancel` to the review server before destroying the view. The CLI exits with `Review cancelled: …`; Forge surfaces that as a neutral status, not an error. The existing 30-minute idle ceiling and heartbeat watchdog keep working unchanged — the embedded page fires the same heartbeats a browser tab does.
4. **Submit.** Unchanged from today: the CLI writes `formatReview` output to `--output-file` and exits 0; `launchSpecReview` reads it and calls `reviseWithReview`. Main destroys the view and resolves the existing IPC invoke. `app.tsx` sets `reviewedContent` + `reviewSummary` through the same stale-guard it already has.
5. **Preflight.** Before spawning, verify the installed `plan-review` supports `--print-url` and fail with an actionable message ("update plan-review to ≥ x.y.z"). Matches AGENTS.md's "verify CLI state and surface errors" rule.

Spec only in Phase 1 — that is parity with today. Triage review is a later phase.

### Round-trip contract (exact, unchanged from today)

| Step | Shape | Owner |
|---|---|---|
| In | `cleanSpecMarkdown(content)` written to temp `review-input.md` | Forge |
| Argv | `[input, '--fresh', '--split-by', 'heading', '-o', 'file', '--output-file', output, '--no-open', '--print-url']` | Forge |
| Ready | one JSON line on stdout: `{"event":"review-server-ready","url":"http://127.0.0.1:<port>"}` | plan-review |
| Document | `GET /api/doc` → `{ document: PlanDocument, initialState }` | plan-review |
| Session | `PUT /api/session` → `FileSessionStore` in `~/.plan-review/sessions/` | plan-review |
| Submit | `POST /api/review` → `ReviewSubmission { comments: ReviewComment[]; verdict: 'approved' \| null; summary: string }` (`packages/core/src/types.ts`) | browser-app |
| Feedback | `formatReview(doc, { verdict, summary })` markdown → `--output-file`, exit 0 | plan-review |
| Revise | `reviseSpecWithReview({ model, originalSpecMarkdown, reviewFeedback })` → `parseSpecReviewResponse` | Forge |
| Result | `SpecReviewResult { content; summary: SpecReviewSummary }` over `IpcChannel.SpecLaunchReview` | Forge |

Nothing downstream of the output file changes. `spec-review-response-parser.ts`, `spec-review-tags.ts` and `SpecReviewSummary` are kept, not deleted. The `**Verdict:** Approved|Comment` line that satisfies the approval gate keeps coming from `SubmitReviewPanel` via `formatReview`.

### Deliberate calls

- **`WebContentsView`, not `<iframe>` or `<webview>`.** `<webview>` is discouraged by Electron and needs `webviewTag: true` — rejected. An `<iframe>` is genuinely simpler (layout follows the drawer for free) but runs the page in Forge's renderer process, shares its future CSP, and would block the mermaid/KaTeX CDN loads the review UI depends on. `WebContentsView` gets its own `webPreferences` (`sandbox: true`, `contextIsolation: true`, no preload, no node) and its own session partition. Electron is pinned at 33.4.11; `WebContentsView` landed in 30.
- **Dedicated full-window surface, not a pane inside the drawer.** The drawer is 55% of a 1240px minimum window — about 682px for three panels. A dedicated surface also removes the bounds-sync problem entirely: the view's bounds are the window content area, so there is no chasing the drawer's 220ms transform or its scrim/modal z-order.
- **Local HTTP, not `file://`.** The review UI is an HTTP client of its own server — `/api/doc`, `/api/review`, session, heartbeat. `file://` cannot serve it. This is the transport the tool already uses.
- **Supervision stays as it is.** One child process per review, owned by the existing `launchSpecReview` promise, killed via `/api/cancel` on close and reaped on window close. No pool, no long-lived daemon, no PID file.
- **Security premise, corrected.** Forge's renderer runs `contextIsolation: true`, `nodeIntegration: false`, `sandbox: false`, and has no CSP (`src/main/index.ts`, `src/renderer/index.html`). v3 stated this wrongly. v4 adds no markdown rendering and no `dangerouslySetInnerHTML` to that renderer at all — the review page runs in a separate, sandboxed `WebContentsView`. Forge's own sandbox and CSP posture is unchanged and out of scope here.

### Upstream changes needed in `~/desenv/personal/plan-review`

Three, all small. Each is a standalone PR against the CLI.

1. **`--no-open`** — skip the `spawnSync(open, url)` in `runBrowserReview`. Without it every embedded review also opens a system browser tab that competes for heartbeats and can submit a second time.
2. **`--print-url`** — emit one JSON line on stdout when the server is listening. Forge needs the ephemeral port and today it exists only inside a human-readable stderr line. *Interim:* Forge can regex `Review server running at (\S+)` from stderr to unblock the spike before this ships.
3. **Bind to loopback** — `startServer` calls `server.listen(port)` with no host, so the review server is reachable from the LAN. `listen(port, '127.0.0.1')` is correct for the CLI too, not just for Forge.

**Explicitly not needed.** A long-lived serve mode: the one-shot process already lives exactly one review, writes the file Forge names, and exits — which is Forge's existing contract. A submit-callback URL: `--output-file` already is the callback. A session id: one drawer, one review, one process.

**Later, not now.** A `--session-key` so resume keys on the Forge artifact identity rather than a temp path — only worth it when Phase 2 wants resume.

### Resolution of review findings

| # | Severity | How v4 handles it |
|---|---|---|
| 1 | BLOCKER | Resolved — the contract is the existing one: `ReviewSubmission` → `formatReview` → output file → `reviseWithReview`. Nothing new invented. |
| 2 | BLOCKER | Resolved — verdict comes from `SubmitReviewPanel`; `SpecReviewSummary` and the parser are kept, not deleted. Approval gate unaffected. |
| 3 | BLOCKER | Resolved — the comparison table is deleted and the reuse path is the design. |
| 4 | MAJOR | Resolved — no capability is lost; the same UI ships. |
| 5 | MAJOR | Resolved — no new npm deps. `@plan-review/core` and `/react` are not consumed; only the `plan-review` CLI, version bumped for the flags above. |
| 6 | MAJOR | Resolved — the revise pipeline is untouched. No streaming, no new channels, no triage path in Phase 1. |
| 7 | MAJOR | Moved upstream — sessions are the CLI's `FileSessionStore` + `computeContentHash`. Forge stores no drafts. (`--fresh` on a temp file means no resume, same as today.) |
| 8 | MAJOR | Not applicable — no Forge autosave. browser-app autosaves via `PUT /api/session`. |
| 9 | MAJOR | Resolved — unchanged: the in-memory tab content is written to the temp input, as today. No write-before-review requirement. |
| 10 | MAJOR | Resolved — premise corrected above; no markdown rendering is added to Forge's renderer, and the review page is sandboxed in its own `WebContentsView`. |
| 11 | MAJOR | Resolved — phases 2+ are headings only; the HITL design moves to the plan-review monorepo. |
| 12 | MAJOR | Moved upstream — theming and accessibility of the review UI belong to browser-app. Forge owns only the close affordance, Escape, and focus return. |
| 13 | MAJOR | Resolved — dedicated full-window surface instead of three panels in a 682px drawer. |
| 14 | MINOR | Not applicable — no Forge markdown pipeline. |
| 15 | MINOR | Moved upstream — mermaid node anchoring is a plan-review concern. |
| 16 | MINOR | Resolved — acceptance list below covers cancel, crash, missing CLI, port failure. |
| 17 | MINOR | Resolved — state table below. |
| 18 | NIT | Resolved — `IpcChannel.SpecLaunchReview` is kept; any addition (e.g. `SpecCancelReview`) is a property of the same object. |

### States and copy

| State | Surface shows | Actions |
|---|---|---|
| Starting | "Starting review…" overlay on the surface | Cancel |
| Ready | the review page | Close |
| CLI missing / too old | error in the Spec tab naming the required version | none |
| Server never announced (timeout) | "Review server did not start" | Retry |
| Cancelled by user or closed window | neutral status in the Spec tab, no error styling | Launch Review |
| Submitted, revising | existing "Review in progress…" in the Spec tab | none |
| Revise failed | existing `reviewErrorMessage` path | Launch Review |

### Done when

- Launching a review for a spec never opens a system browser tab, and the review UI appears inside the Forge window with line anchors, mermaid, KaTeX and the submit panel intact.
- Submitting produces the same `SpecReviewResult` the CLI flow produces today, with `verdict` and `commentCount` populated, rendered by the untouched `spec-tab.tsx` summary UI.
- Closing the surface mid-review cancels cleanly: no orphan process, no orphan port, neutral status.
- Killing the CLI process, an unavailable CLI, and a failed server start each surface a distinct actionable message rather than hanging.
- Closing the Forge window during a review terminates the child process.
- The stale-completion guard in `app.tsx` still discards a result whose drawer has moved on.

### Later phases (not designed here)

- **Phase 2 — triage briefs.** Give `triage-drawer.tsx` the same launch path. Needs a handler and review state it does not have today; otherwise identical plumbing.
- **Phase 3 — session identity.** Pass the real artifact path or a `--session-key` so resume works across drawer closes, once Phase 1 shows resume is actually wanted.
- **Phase 4 — HITL features.** Decisions, suggestion diffs, node-anchored mermaid threads, drafted replies. Built in the plan-review monorepo, consumed by Forge for free. Out of scope for Forge entirely.
- **Phase 5 — Linear writeback.** Push resolved threads to the originating issue via `.agents/skills/linear/`.

### Out of scope

Rewriting any part of plan-review inside Forge. New review capabilities of any kind. Streaming the revise step. Multi-artifact or concurrent review. Changing Forge's renderer sandbox or CSP posture.

---

## Open Questions

- [ ] Should the review surface cover the whole window, or leave the issue list visible on the left as orientation? Full-window is simpler and is the assumption above.
- [ ] Do the three upstream flags ship as one release of `plan-review`, or does Forge run against a local `npm link` during Phase 1 and pin a published version at the end?
- [ ] Should Forge continue to pass `--fresh`? Keeping it preserves today's behaviour exactly; dropping it does nothing useful until Phase 3 gives sessions a stable key.
