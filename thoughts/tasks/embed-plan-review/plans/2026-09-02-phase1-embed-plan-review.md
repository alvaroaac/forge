# Phase 1 — In-window plan-review Implementation Plan

**Goal:** Launching a spec review opens the existing plan-review browser UI inside the Forge window instead of the system browser, with the round-trip contract unchanged.

**Architecture:** Forge keeps spawning the `plan-review` CLI with the same temp-file input and the same `--output-file` result. Three small upstream flags let the CLI stay headless and announce its ephemeral URL; Forge loads that URL into a sandboxed Electron `WebContentsView` covering the window below the topbar. Rejected alternative: a Forge-native review UI (spec v3) — blocked by `spec-review.md` because it duplicated plan-review's parser, anchoring and session store with no capability gain.

**Tech Stack:** Electron 33.4.11 (`WebContentsView`, added in Electron 30), React 18, TypeScript, vitest. No new npm dependencies in Forge; upstream adds none either.

**Spec:** `thoughts/tasks/embed-plan-review/initial-spec.md` (v4, Approved 2026-09-02). Review that shaped it: `thoughts/tasks/embed-plan-review/spec-review.md`.

**Repos:** Tasks 1–3 and 9 land in `/Users/alvarocarvalho/desenv/personal/plan-review`. Tasks 4–8 land in `/Users/alvarocarvalho/desenv/personal/forge`.

## Global Constraints

- TDD: each task's **Behavior** bullets are its test list — write failing tests from them first, then implement. Commit per task.
- Forge conventions in `thoughts/conventions.md` apply: TypeScript everywhere, no `any` without a same-line `// reason:`, cyclomatic complexity ≤ 4 per function, IPC channels named `domain:action`, no Node APIs in the renderer.
- Forge tests live in `tests/main/**` and `tests/renderer/**` (`vitest.config.ts`), never beside the source.
- The round-trip contract is frozen: `cleanSpecMarkdown` → temp `review-input.md` → CLI → `--output-file` → `reviseWithReview` → `SpecReviewResult`. `spec-review-response-parser.ts`, `spec-review-tags.ts`, `SpecReviewSummary` and `spec-tab.tsx`'s summary UI are not touched.
- Forge Phase 1 is spec-only. No triage review path, no streaming of the revise step, no change to Forge's renderer `sandbox`/CSP posture (`src/main/index.ts:53`).
- Upstream changes are additive and default-off: existing CLI invocations must behave exactly as they do today.
- Log every deliberately skipped item to `thoughts/tech-debt.md` in the documented entry format.

## File Structure & Decomposition

Three new Forge modules carry the new responsibilities — `plan-review-version.ts` (preflight), `plan-review-ready.ts` (pure ready-line parser), `review-surface.ts` (`WebContentsView` lifecycle) — plus `src/shared/layout.ts` for the one geometry constant main and the renderer must agree on. Everything else is edits to existing wiring: the bridge, the spec IPC module, `register.ts`, `preload.ts`, `index.ts`, and two renderer components. Upstream touches only `server.ts`, `browser-review.ts` and `index.ts` in `packages/cli`. Per-task file lists are exact below.

## Deliberate calls

- **`WebContentsView`, not `<iframe>` or `<webview>`.** An iframe would run the review page in Forge's renderer process and inherit its future CSP, blocking the jsDelivr mermaid/KaTeX loads the page depends on; `<webview>` is discouraged by Electron and needs `webviewTag: true`. The view gets its own `webPreferences` (`sandbox: true`, `contextIsolation: true`, `nodeIntegration: false`, no preload) and its own session partition, so nothing about Forge's renderer posture changes.
- **Full-window surface below the topbar, not a drawer pane.** The drawer is 55% of a 1240px minimum window; three plan-review panels do not fit in ~682px (`spec-review.md` issue 13). Bounds are the window content area inset by the topbar, so there is nothing to sync against the drawer's transition or scrim.
- **Main computes bounds from `win.getContentBounds()` minus a shared `TOPBAR_HEIGHT`**, rather than the renderer measuring and posting a rect over IPC. One constant, no per-resize IPC chatter; the drift risk is covered by a test that reads `--topbar-h` out of `tokens.css:38`.
- **Escape is intercepted in main via `before-input-event` on the view's `webContents`.** While the view has focus the renderer never sees the keydown, so a renderer-side handler would silently do nothing.
- **Main POSTs `/api/cancel` explicitly before destroying the view.** The browser-app's `sendBeacon('/api/cancel')` on unload (`packages/browser-app/src/App.tsx:173`) is not guaranteed to fire when a `WebContentsView` is destroyed; the explicit POST makes cancel deterministic and the heartbeat watchdog stays a backstop, not the mechanism.
- **Keep `--fresh`.** Dropping it buys nothing until Phase 3 gives sessions a stable key: the input path is a fresh temp dir per launch, so a resume could never match. Keeping it preserves today's behaviour exactly (Open Question 3, resolved).
- **`npm link` during Tasks 4–8, pinned published version in Task 9.** Forge's Tasks 4–8 need flags that are not on npm yet; developing against a linked local build avoids a publish-per-iteration loop, and Task 9 makes the dependency honest before merge (Open Question 2, resolved).
- **Interim stderr fallback, not a permanent dual path.** Until Task 3 ships, `parseReviewServerReady` also matches the existing human-readable stderr line `Review server running at <url>` (`packages/cli/src/browser-review.ts:77`), so Forge can run against published `plan-review@1.1.6`. The preflight in Task 4 is what makes the JSON line the supported path; the regex branch stays as a one-line tolerance and is logged as tech debt for removal in Phase 2.
- **Cancellation is a neutral outcome, not an error.** The CLI exits 1 with a message starting `Review cancelled` (`packages/cli/src/index.ts:50`). Forge distinguishes that prefix from a genuine failure so closing the surface does not paint `reviewErrorMessage` red.

## Task dependency order

Tasks 1, 2, 3 (upstream) run in parallel. Tasks 4 → 5 → 6 → 7 → 8 (Forge) run in sequence. Task 9 depends on all of them.

Tasks 1–3 are independent of each other and can run in parallel. Tasks 4–8 are strictly sequential. Task 5 can start against published `plan-review@1.1.6` using the stderr fallback; Tasks 7–8 need Tasks 2–3 linked locally to be verified end to end. Task 9 is last and requires every other task green.

---

### Task 1: Bind the review server to loopback

**Repo:** `/Users/alvarocarvalho/desenv/personal/plan-review`

**Files:**
- Modify: `packages/cli/src/server/server.ts`
- Test: `packages/cli/tests/server/server.test.ts`

**Interfaces:**
- Produces: `startServer(server: Server, port: number): Promise<{ url: string }>` — signature unchanged; the returned `url` becomes `http://127.0.0.1:<port>`.

**Behavior:**
- `startServer` listens on `127.0.0.1` only; a request to the server via a non-loopback local interface address is refused.
- The resolved `url` uses the host `127.0.0.1`, not `localhost` (`server.ts:14` currently hardcodes `localhost`).
- Passing port `0` still resolves with the OS-assigned ephemeral port.
- A listen error (e.g. port in use) still rejects the promise rather than hanging.

**Verify:**
- Run: `cd /Users/alvarocarvalho/desenv/personal/plan-review && npm run test -w plan-review && npm run typecheck -w plan-review`
- Expected: CLI suite green, including the existing `browser-integration.test.ts` which drives the real server.

---

### Task 2: `--no-open` CLI flag

**Repo:** `/Users/alvarocarvalho/desenv/personal/plan-review`

**Files:**
- Modify: `packages/cli/src/index.ts`, `packages/cli/src/browser-review.ts`
- Test: `packages/cli/tests/index.test.ts`

**Interfaces:**
- Produces: `BrowserReviewOptions` gains `open?: boolean` (default `true`). CLI flag `--no-open`, described as `Do not open the review URL in a browser (for embedded hosts)`.

**Behavior:**
- Without the flag, `runBrowserReview` still `spawnSync`s the platform opener exactly as today (`browser-review.ts:80-86`) — default behaviour is untouched.
- With `--no-open`, no opener process is spawned, and the fallback line `Open <url> in your browser` is still written to stderr so a terminal user is never stranded.
- The review lifecycle is unchanged: heartbeat watchdog, 30-minute idle ceiling, cancel and submit behave identically. `--no-open` with `--cli` is accepted and inert.

**Verify:**
- Run: `cd /Users/alvarocarvalho/desenv/personal/plan-review && npm run test -w plan-review && npm run typecheck -w plan-review`
- Expected: new flag test green; opener is asserted via an injected/spied spawn, not by actually opening a browser.

---

### Task 3: `--print-url` machine-readable ready line

**Repo:** `/Users/alvarocarvalho/desenv/personal/plan-review`

**Files:**
- Modify: `packages/cli/src/index.ts`, `packages/cli/src/browser-review.ts`
- Test: `packages/cli/tests/index.test.ts`

**Interfaces:**
- Produces: CLI flag `--print-url`, described as `Print a JSON ready line on stdout when the review server is listening`.
- Produces (wire format, contractual — one line, newline-terminated, on **stdout**):
  ```json
  {"event":"review-server-ready","url":"http://127.0.0.1:54321"}
  ```

**Behavior:**
- The line is written exactly once, on stdout, after the server is listening and before the review promise is awaited. It is the only JSON event — this is an announcement, not a stream protocol.
- The existing human-readable `Review server running at <url>` line stays on stderr, unchanged, so terminal UX does not regress.
- Without the flag, stdout carries nothing new — stdout stays clean for `-o stdout` consumers.
- The `url` field equals the value `startServer` resolved (Task 1's `127.0.0.1` form), including the ephemeral port.

**Verify:**
- Run: `cd /Users/alvarocarvalho/desenv/personal/plan-review && npm run test -w plan-review && npm run typecheck -w plan-review`
- Expected: a test asserts the exact JSON shape and that `JSON.parse` of the stdout line yields `event` and `url`.

---

### Task 4: plan-review version preflight

**Repo:** `/Users/alvarocarvalho/desenv/personal/forge`

**Files:**
- Create: `src/main/services/plan-review-version.ts`
- Test: `tests/main/plan-review-version.test.ts`

**Interfaces:**
- Consumes: `tryExecFile(file, args)` from `src/main/lib/exec.ts:19` (returns `Result<{stdout, stderr}>`, 5s timeout, `buildCliEnv()`).
- Produces:
  ```ts
  export const PLAN_REVIEW_MIN_VERSION = '1.2.0';
  export type PlanReviewVersionCheck =
    | { ok: true; version: string }
    | { ok: false; reason: 'missing' | 'too-old'; version?: string };
  export function parsePlanReviewVersion(stdout: string): string | null;
  // `exec` defaults to tryExecFile; injected in tests.
  export function checkPlanReviewVersion(exec?: typeof tryExecFile): Promise<PlanReviewVersionCheck>;
  export function planReviewVersionError(check: PlanReviewVersionCheck): Error | null;
  ```

**Behavior:**
- `parsePlanReviewVersion` extracts a semver from `plan-review --version` output, tolerating surrounding whitespace and a trailing newline; returns `null` for unparseable output.
- `checkPlanReviewVersion` returns `{ok:false, reason:'missing'}` when the exec fails (ENOENT or non-zero exit) or the version is unparseable; `{ok:false, reason:'too-old', version}` below `1.2.0`; `{ok:true, version}` at `1.2.0` and above.
- Comparison is numeric per semver component, so `1.10.0` is newer than `1.2.0`, and prerelease suffixes are ignored.
- `planReviewVersionError` returns `null` when `ok`, an Error reading `plan-review CLI not found. Install plan-review >= 1.2.0 to run reviews inside Forge.` for `missing`, and `plan-review <version> is too old. Update to >= 1.2.0 to run reviews inside Forge.` for `too-old`.

**Verify:**
- Run: `npx vitest run tests/main/plan-review-version.test.ts && npm run typecheck && npm run lint`
- Expected: all cases green; no real `plan-review` process is spawned (exec is injected).

---

### Task 5: Bridge emits the server URL and a cancel handle

**Repo:** `/Users/alvarocarvalho/desenv/personal/forge`

**Files:**
- Create: `src/main/lib/plan-review-ready.ts`
- Modify: `src/main/services/spec-review-bridge.ts`
- Test: `tests/main/plan-review-ready.test.ts`, `tests/main/spec-review-bridge.test.ts` (existing, extend)

**Interfaces:**
- Consumes: `checkPlanReviewVersion`, `planReviewVersionError` (Task 4).
- Produces:
  ```ts
  // src/main/lib/plan-review-ready.ts
  export function parseReviewServerReady(line: string): string | null;

  // src/main/services/spec-review-bridge.ts
  export interface ReviewServerContext { url: string; cancel: () => Promise<void>; }
  export interface LaunchSpecReviewDeps {
    /* ...existing fields unchanged... */
    preflight?: () => Promise<void>;
    onServerReady?: (context: ReviewServerContext) => void | Promise<void>;
    onReviewSettled?: () => void | Promise<void>;
    postCancel?: (url: string) => Promise<void>;
  }
  ```
  `launchSpecReview(input, deps)` keeps its existing signature and return type `Promise<SpecReviewResult>`.

**Behavior:**
- `parseReviewServerReady` returns the URL from a JSON line whose `event` is `review-server-ready`; returns `null` for other JSON, for malformed JSON, and for unrelated text.
- It also returns the URL from the legacy stderr line `Review server running at <url>` — the interim fallback for `plan-review@1.1.6`.
- It rejects a URL whose origin is not `http://127.0.0.1:<port>` or `http://localhost:<port>`, returning `null`, so a malformed announcement can never point the embedded view at a remote origin.
- `planReviewArgs` (`spec-review-bridge.ts:60`) appends `--no-open` and `--print-url` after the existing arguments; the existing arguments and their order are unchanged.
- The child is spawned with `stdio: ['ignore', 'pipe', 'pipe']` (was `['ignore','ignore','pipe']` at `spec-review-bridge.ts:79`); stdout is scanned line-by-line for the ready announcement, and stderr accumulation for error messages is unchanged.
- `onServerReady` fires at most once, with the first accepted URL, before the child exits. `cancel()` POSTs to `<url>/api/cancel` (via injected `postCancel`, default `fetch`) and resolves even if the POST fails — a dead server is already cancelled.
- If the child exits before any ready line, `launchSpecReview` rejects with `Review launch failed: Review server did not start`; the existing `Review launch failed: ` prefix from `toReviewLaunchError` (`:130`) is preserved for every failure.
- `preflight` runs before the temp dir is created; its rejection propagates through `toReviewLaunchError` and no process is spawned. `onReviewSettled` runs exactly once on both success and failure, before the temp-dir cleanup in the existing `finally` (`:178`).
- Submit path is unchanged: exit 0 → read `--output-file` → `reviseWithReview` → `SpecReviewResult`.

**Verify:**
- Run: `npx vitest run tests/main/plan-review-ready.test.ts tests/main/spec-review-bridge.test.ts && npm run typecheck && npm run lint`
- Expected: the existing bridge tests still pass after their `stdio` assertion is updated to `['ignore','pipe','pipe']`.

---

### Task 6: Review surface (`WebContentsView`)

**Repo:** `/Users/alvarocarvalho/desenv/personal/forge`

**Files:**
- Create: `src/shared/layout.ts`, `src/main/services/review-surface.ts`
- Test: `tests/main/review-surface.test.ts`, `tests/main/layout.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // src/shared/layout.ts
  export const TOPBAR_HEIGHT = 44;

  // src/main/services/review-surface.ts
  export interface ReviewSurface {
    show(url: string): Promise<void>;
    destroy(): Promise<void>;
    isOpen(): boolean;
  }
  export interface ReviewSurfaceDeps {
    createView?: (options: unknown) => ReviewSurfaceView; // injected for tests
  }
  export function createReviewSurface(
    win: BrowserWindowLike,
    handlers: { onEscape: () => void },
    deps?: ReviewSurfaceDeps,
  ): ReviewSurface;
  ```
  `BrowserWindowLike` is a narrow structural type over the `BrowserWindow` members used (`contentView.addChildView`, `contentView.removeChildView`, `getContentBounds`, `on('resize'|'closed')`), so tests need no real Electron window.

**Behavior:**
- `show(url)` creates a `WebContentsView` with `webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, partition: 'persist:plan-review' }` and no preload, adds it to the window's content view, and loads the URL. Called while one is already open, it destroys the previous view first — never two stacked views.
- Bounds are `{ x: 0, y: TOPBAR_HEIGHT, width: contentWidth, height: contentHeight - TOPBAR_HEIGHT }`, recomputed on every window `resize`.
- Escape pressed inside the view (`before-input-event`, `keyDown`, key `Escape`) invokes `onEscape` exactly once per press and does not forward the key to the page.
- `destroy()` removes the view, destroys its `webContents`, detaches the resize listener, and is idempotent; `isOpen()` reflects that state; the window's `closed` event destroys the surface.
- `layout.test.ts` reads `src/renderer/styles/tokens.css` and asserts `--topbar-h` (`tokens.css:38`) parses to `TOPBAR_HEIGHT`, so the two cannot drift.

**Verify:**
- Run: `npx vitest run tests/main/review-surface.test.ts tests/main/layout.test.ts && npm run typecheck && npm run lint`
- Expected: green with a fake window and injected view factory; no Electron runtime required.

---

### Task 7: IPC, preload and lifecycle wiring

**Repo:** `/Users/alvarocarvalho/desenv/personal/forge`

**Files:**
- Modify: `src/shared/ipc-channels.ts`, `src/shared/forge-api.ts`, `src/main/preload.ts`, `src/main/ipc/spec.ts`, `src/main/ipc/register.ts`, `src/main/index.ts`
- Test: `tests/main/ipc-spec-review.test.ts` (existing, extend), `tests/main/preload.test.ts` (existing, extend), `tests/main/register.test.ts` (existing, extend)

**Interfaces:**
- Consumes: `launchSpecReview` + `ReviewServerContext` (Task 5), `createReviewSurface` (Task 6), `checkPlanReviewVersion` (Task 4).
- Produces:
  ```ts
  // src/shared/ipc-channels.ts — added to the existing IpcChannel object
  SpecCancelReview: 'spec:cancel-review',

  // src/main/preload.ts — added to the existing forge.spec surface
  cancelReview: (issueId: string) => Promise<void>;

  // src/main/ipc/spec.ts
  export interface SpecLaunchReviewDeps {
    launchReview: (input: { issueId: string; content: string; model: string }) => Promise<SpecReviewResult>;
    cancelReview: (input: { issueId: string }) => Promise<void>;
  }
  export function registerSpecCancelReviewHandler(ipc: IpcMain, deps: Pick<SpecLaunchReviewDeps, 'cancelReview'>): void;
  ```

**Behavior:**
- `register.ts` composes the deps at the existing `registerSpecLaunchReviewHandler` call site (`register.ts:121`): `preflight` from Task 4, `onServerReady` showing the surface at the announced URL, `onReviewSettled` destroying it.
- Only one review may be in flight; a second `spec:launch-review` while one is active rejects with `A review is already in progress.` and does not spawn a process.
- `spec:cancel-review` for the active review calls the stored `ReviewServerContext.cancel()` then destroys the surface; the in-flight `spec:launch-review` invoke then rejects through the normal CLI-exit path. Escape (Task 6's `onEscape`) takes the same path.
- `spec:cancel-review` with no active review, or for a different `issueId` than the active one, resolves without doing anything — closing a stale surface is never an error.
- A CLI failure whose message contains `Review cancelled` resolves to a cancellation outcome rather than propagating as a launch error, and the surface is destroyed either way.
- `src/main/index.ts` registers the surface against the created window and destroys it plus kills the active review on window `closed` — no orphan process survives the window.
- `preload.test.ts` asserts `forge.spec.cancelReview` invokes `spec:cancel-review` with `{ issueId }`; `register.test.ts` asserts both spec review channels are registered.

**Verify:**
- Run: `npx vitest run tests/main/ipc-spec-review.test.ts tests/main/preload.test.ts tests/main/register.test.ts && npm run typecheck && npm run lint`
- Expected: all three suites green; existing launch-review passthrough test unchanged.

---

### Task 8: Renderer surface chrome, states and copy

**Repo:** `/Users/alvarocarvalho/desenv/personal/forge`

**Files:**
- Modify: `src/renderer/app.tsx`, `src/renderer/components/spec-tab.tsx`, `src/renderer/styles/tokens.css`
- Test: `tests/renderer/app.test.tsx` (existing, extend), `tests/renderer/spec-tab.test.tsx` (existing, extend)

**Interfaces:**
- Consumes: `window.forge.spec.launchReview(issueId, content, model)` (existing) and `window.forge.spec.cancelReview(issueId)` (Task 7).
- Produces: `spec-tab.tsx` gains `reviewStatusMessage?: string | null`, rendered in the existing status region, styled neutrally — not through `reviewErrorMessage`.

**Behavior:**
- While `isReviewPending` and before the surface reports ready, the renderer shows a full-window scrim below the topbar with the copy `Starting review…` and a `Cancel` button; the scrim sits under where the `WebContentsView` will be placed, so it is replaced, not overlapped.
- Once the review surface is up, the topbar shows a `Close review` affordance; clicking it calls `cancelReview` with the active issue id.
- A cancelled review sets `reviewStatusMessage` to `Review cancelled.` and leaves `reviewedContent`, `reviewSummary` and `reviewErrorMessage` untouched; the Spec tab returns to offering `Launch Review`.
- A failed server start sets `reviewStatusMessage` to `Review server did not start.` and re-enables `Launch Review` as the retry affordance.
- A missing or too-old CLI surfaces the Task 4 error text through the existing `reviewErrorMessage` path, in error styling.
- Success is unchanged: `reviewedContent` + `reviewSummary` are set, and the existing stale guard (`app.tsx:186-209`) still discards a result whose drawer has moved on — the added state must be inside that same guard.
- `reviewStatusMessage` is cleared when a new review is launched and when the drawer switches issues.

**Verify:**
- Run: `npx vitest run tests/renderer/app.test.tsx tests/renderer/spec-tab.test.tsx && npm run typecheck && npm run lint`
- Expected: existing review tests still green; new cases cover cancel, server-not-started, stale-guard-during-cancel.
- Manual: `npm run dev`, open a spec, click `Launch Review` — no browser tab opens, the plan-review UI renders inside the window with mermaid and the submit panel, Escape closes it, submitting populates the Spec tab summary.

---

### Task 9: Release plan-review and pin it in Forge

**Repos:** both

**Files:**
- Modify: `/Users/alvarocarvalho/desenv/personal/plan-review/packages/cli/package.json`
- Modify: `/Users/alvarocarvalho/desenv/personal/forge/package.json`

**Behavior:**
- Bump the CLI to `1.2.0` (minor: three additive, default-off flags) and publish it. **Owner-gated:** the npm publish is a manual step for the owner; the implementer prepares the bump and stops.
- Forge's `plan-review` dependency moves from `^1.1.5` to `^1.2.0`, and `PLAN_REVIEW_MIN_VERSION` (Task 4) is confirmed to equal `1.2.0`.
- Any local `npm link` used during Tasks 4–8 is unlinked, and a clean `npm install` resolves `plan-review` from the registry.
- Log to `thoughts/tech-debt.md`: the stderr-regex fallback branch in `parseReviewServerReady`, to be removed once no supported plan-review predates 1.2.0.

**Verify:**
- Run (Forge): `npm install && npm test && npm run typecheck && npm run lint && npm run build`
- Expected: `node_modules/plan-review/package.json` reports `1.2.0` or higher, and `plan-review --version` from Forge's `buildCliEnv()` PATH agrees.

---

## Final validation checklist

- [ ] `cd /Users/alvarocarvalho/desenv/personal/plan-review && npm run test && npm run typecheck` — all workspaces green.
- [ ] Existing `plan-review <file>` with no new flags still opens a browser tab and still prints nothing extra on stdout.
- [ ] `cd /Users/alvarocarvalho/desenv/personal/forge && npm test && npm run typecheck && npm run lint && npm run build` — all green.
- [ ] Launch Review on a generated spec: no system browser tab opens; the review UI renders in-window with line anchors, mermaid, KaTeX and the submit panel.
- [ ] Submit: `SpecReviewSummary` shows verdict and comment count in the untouched `spec-tab.tsx` summary UI.
- [ ] Close via the topbar affordance and via Escape: neutral `Review cancelled.` status, no `plan-review` process left (`pgrep -f plan-review` is empty), no listening port left (`lsof -iTCP -sTCP:LISTEN | grep 127.0.0.1`).
- [ ] Kill the `plan-review` child mid-review: a distinct actionable message, no hang.
- [ ] Rename/hide the `plan-review` binary and launch: the CLI-missing message names the required version.
- [ ] Close the Forge window mid-review: the child process is gone.
- [ ] Switch drawer issues mid-review, then let it complete: the result is discarded by the stale guard.
- [ ] `thoughts/tech-debt.md` has an entry for the stderr-regex fallback and for anything else deliberately skipped.
- [ ] Per-task `progress.md`, `spec-review.md`, `qa-review.md` exist under `thoughts/tasks/embed-plan-review/impl/task-<N>/`, and `impl/final-review.md` is written.
