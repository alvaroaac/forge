# Phase 1 — PR review surface (findings viewer + durable triage) Implementation Plan

**Goal:** Forge gains a `Reviews` mode that discovers every `pr-review-*.json` written by the `pr-review` skill across the configured repos, renders the findings natively, and keeps triage state that survives quitting the app.

**Architecture:** The filesystem stays the integration point. A main-process reader scans `<repo>/.pr-review/*.json` for the two configured repo paths, validates each file against schema v1, and returns opaque-id rows over four new `pr:*` IPC channels; triage lives in `~/.forge/pr-triage/<reviewId>.json`, written whole-file and atomically. The renderer holds no filesystem path and never parses a review file. Rejected alternative: shelling out to `pr-report/build.py` and embedding its HTML — it would put a second renderer inside Forge's window with no triage persistence and no cross-repo list.

**Tech Stack:** Electron 33, React 18, TypeScript (strict), vitest. No new npm dependencies — `node:crypto`, `node:fs/promises` and `shell.openExternal` cover everything.

**Spec:** `thoughts/tasks/pr-review-surface/initial-spec.md` (v2.1, Approved 2026-09-02). Review that shaped it: `thoughts/tasks/pr-review-surface/spec-review.md` (B1–B2, M1–M9, m1–m6, N1–N4 all resolved).

**Repos:** Task 1 lands in `/Users/alvarocarvalho/.agent-skills/pr-report`. Tasks 2–9 land in `/Users/alvarocarvalho/desenv/personal/forge`.

## Global Constraints

- TDD: each task's **Behavior** bullets are its test list — write failing tests from them first, then implement. Commit per task.
- Forge conventions in `thoughts/conventions.md` apply: TypeScript everywhere, no `any` without a same-line `// reason:`, cyclomatic complexity ≤ 4 per function, IPC channels named `domain:action`, no Node APIs in the renderer.
- Forge tests live in `tests/main/**`, `tests/renderer/**`, `tests/shared/**` (`vitest.config.ts` includes `tests/**/*.test.ts(x)` only), never beside the source.
- Schema v1 (`~/.agent-skills/pr-review/schema.md`) is a **read-only contract**. Forge never writes a findings file, never adds a field to one, and never coerces a version.
- The IPC block in the spec ("IPC contract (verbatim, contractual)") is frozen. Channel names, type names, field names and union members are reproduced exactly; nothing is added to or renamed in it during Phase 1.
- Forge state never enters the skill's JSON. Triage is a sidecar under `~/.forge/`.
- Log every deliberately skipped item to `thoughts/tech-debt.md` in the documented entry format.

## File Structure & Decomposition

Three new main-process modules carry the new responsibilities — `pr-findings-schema.ts` (pure validate/normalise), `pr-findings-reader.ts` (scan, identity, ordering), `pr-triage-store.ts` (durable state) — plus `src/shared/pr-prompt.ts` (the mirrored derived-text logic) and one new IPC module `src/main/ipc/pr-review.ts` with `src/main/ipc/app.ts` for `app:open-external`. The renderer gets one hooks pair and six presentational components under `src/renderer/components/pr/`. Everything else is edits to existing wiring: `types.ts`, `ipc-channels.ts`, `forge-api.ts`, `preload.ts`, `register.ts`, `paths.ts`, `index.ts`, `app.tsx`, `top-bar.tsx`, `tokens.css`. Per-task file lists are exact below.

## Deliberate calls

- **Fixtures live in `tests/fixtures/pr-review/`, not `src/main/services/__fixtures__/pr-review/` as the spec sketched.** `vitest.config.ts` only collects from `tests/**`, `thoughts/conventions.md` keeps tests out of `src/`, and anything under `src/` is bundled by electron-vite into the shipped app. The spec's path is a location detail, not a contract.
- **Vendor a corpus subset; never read the computron clone from a test.** `computronRepoPath` is a machine-local config value and `.pr-review/` is untracked, so a test that reads it fails on any other machine and drifts as new reviews land. Eleven fixture files (five verbatim from the corpus, six derived) cover every acceptance case; the real directory is exercised once, manually, in the final checklist.
- **The scanner reads only regular files matching `*.json` directly inside `.pr-review/`.** The real directory also holds eleven `pr-report-*.html` files and a `3642/` subdirectory (neither mentioned in the spec); a naive `readdir` would try to parse both. Fixtures reproduce that noise so the filter is tested, not assumed.
- **Version routing follows the spec exactly:** neither `version` nor `schemaVersion` present → `schema-invalid` (the file is not a findings document); either present but not `1` → `unsupported-version`, naming the file and the value. `schemaVersion` is an accepted alias, normalised to `version: 1` in the parsed document.
- **Grouping and ordering happen in main, not the renderer.** One sort implementation, tested in the node environment against fixtures, and the renderer only walks an already-ordered array — the row order is part of acceptance criteria 1 and 3.
- **`getReview`/`getTriage` reject any id absent from the map rebuilt by the last `listReviews`.** That closes path traversal (the renderer never holds a path) at the cost of a list-before-read ordering rule, which the hook enforces. An unknown id returns the frozen union's `'unreadable'` reason with detail `Unknown review id — refresh the list.`; the union is contractual and gains no new member for this.
- **`getTriage` stays in the contract but is unused by the Phase 1 renderer.** `getReview` already embeds the triage document, so calling both would double-read; the channel is registered and tested because Phase 4 needs it for `postedAt`. Logged as tech debt so its Phase-1 unusedness is intentional and visible.
- **`app:open-external` allowlists by parsed origin, not string prefix.** `new URL(u)` must yield `protocol === 'https:'` and `hostname === 'github.com'`. A literal `startsWith('https://github.com/')` check is equivalent here, but an origin check cannot be defeated by a future `githubUrl` shape; refusals return `{ ok: false }` and are logged.
- **`pr-prompt.ts` is a TypeScript reimplementation guarded by a vendored oracle, not a wrapper around upstream JS.** Forge ships packaged and cannot read `~/.agent-skills` at runtime, so the upstream module is vendored into `tests/fixtures/pr-report/composer-logic.js` as a **test-only** oracle with a pinned sha256 — a byte-equality test proves the port matches today, and the pinned hash makes an upstream edit fail loudly instead of diverging silently.
- **The upstream lift is mechanical, and smaller than the spec assumed.** `template.html` already delimits a DOM-free block with `// COMPOSER-LOGIC-START` (line 225) / `// COMPOSER-LOGIC-END` (line 420), and `test_composer.mjs` already extracts it by regex and runs it under `node:vm`. The spec's "there is no module boundary today" is stale; Task 1 turns that regex scrape into a real file and inlines it at build time.
- **The lifted module is a classic script, not an ES module.** The generated report is a single standalone HTML with no module loader, so `export` statements would break the browser path; a classic script is loadable by an inline `<script>`, by `test_composer.mjs`'s `node:vm` context, and by Forge's oracle test unchanged.
- **`draftFor` is ported in Phase 1 even though the composer is Phase 4.** The oracle is vendored once with a pinned hash; porting half of it means a second pass over the same file at Phase 4 against a hash that has already moved. The unused export is logged as tech debt.
- **No file watcher.** Refresh on entering Reviews mode plus an explicit refresh button, per the spec. A watcher across two repos for a directory written every few days is machinery without a demand.
- **Card-level detail decided here (spec m6 deferred it to this plan):** cards render expanded for `critical`/`major` and collapsed for `minor`/`nit`; the copy button swaps its label to `Copied` for 1.5s; `snippet` renders in a monospace `<pre>` with no diff colouring in Phase 1 (tech debt); a critical-strip entry scrolls its card into view and focuses it.

## Task dependency order

Task 1 (upstream) is independent and may run first or in parallel with Tasks 2–3. Task 2 (fixtures) and Task 3 (shared contract) are independent of each other. Tasks 4 → 5 → 6 depend on 2 and 3. Task 7 depends on 1 and 2. Task 8 depends on 4, 5, 6. Task 9 depends on 7 and 8.

---

### Task 1: Lift the composer logic out of `template.html`

**Repo:** `/Users/alvarocarvalho/.agent-skills/pr-report`

**Files:**
- Create: `composer-logic.js`
- Modify: `template.html`, `build.py`, `test_composer.mjs`, `test_build.py`

**Interfaces:**
- Produces: `composer-logic.js` — a classic script (no `export`, no `import`, no DOM access, no reference to `DATA`) whose contents are the current `template.html` lines between `// COMPOSER-LOGIC-START` and `// COMPOSER-LOGIC-END`, **verbatim**, including `ghRepo`, `isInline`, `findingLoc`, `fallbackDraft`, `severitySummary`, `countSeverities`, `introFallbackText`, `draftFor`, `introFor`, `bulletFor`, `promptSection`, `agentPromptFor`, `batchPrompt`, `buildFullComment` and `buildReviewPayload`. The marker comments move with it and remain the file's first and last lines.
- Produces: `template.html` carries the placeholder `<!--COMPOSER_LOGIC-->` where the block was, inside the existing `<script>` and after the `DATA` constant.
- Produces: `build.py` gains `inject_composer(template_text, logic_text)`, applied before `inject(...)`, replacing the placeholder exactly once.

**Behavior:**
- The function bodies are not edited in this task. `agentPromptFor` keeps its fallback header (`"Review and address this <severity> finding in <file:line>: <title>."` when `agentPrompt` is missing or blank) and its `Finding details` / `Failure scenario` / `Suggested fix` sections joined by blank lines; `draftFor` keeps its `edits` → `prCommentDraft` → `fallbackDraft` precedence with a present-but-empty `edits` key winning.
- `build.py` reads `composer-logic.js` from beside itself and inlines it; a built report contains `function agentPromptFor` exactly once and no `<!--COMPOSER_LOGIC-->` remainder. `build.py` fails with a clear message if the placeholder is absent or the logic file contains the literal `</script>`.
- `test_composer.mjs` loads `composer-logic.js` directly into its `node:vm` context instead of regex-scraping `template.html`; the marker-extraction helper and its two marker assertions are deleted. Every existing composer assertion passes unchanged.
- `test_build.py` gains a case asserting the built HTML from the real template contains `function agentPromptFor` and no placeholder.
- A report built before and after this change renders identically for `fixtures/sample.json` — the change is a relocation, not a behaviour change.

**Verify:**
- Run: `cd ~/.agent-skills/pr-report && node --test test_composer.mjs && python3 -m unittest test_build -v`
- Expected: composer suite green with no marker helper; build suite green including the new inline case.

---

### Task 2: Vendor the fixture corpus

**Repo:** `/Users/alvarocarvalho/desenv/personal/forge`

**Files:**
- Create: `tests/fixtures/pr-review/` (contents below)
- Create: `tests/fixtures/pr-report/composer-logic.js` (copied verbatim from Task 1's output)
- Create: `tests/fixtures/pr-review/README.md` — one paragraph per fixture stating its source file and what it exercises
- Test: `tests/main/pr-fixtures.test.ts`

**Interfaces:**
- Produces: the fixture directory, laid out as a realistic `.pr-review/` so a reader can be pointed straight at it.

  Copied verbatim from `computron/.pr-review/`:
  - `pr-review-demo-void-time-entry.json` — `schemaVersion: 1` alias, `pr.number: null`, no `pr.title`, no `prIntroDraft`/`existingComments`/`cost`, unknown per-finding keys `sourcePath` and `verifyNote`, 8 findings
  - `pr-review-ful-85-time-off-timezones.json` — `findings: []`, `pr.number: null` → clean-review state
  - `pr-review-3668.json` — same-number pair member A (`pr.number: 3668`, branch `ful-17-route-endpoints-api`, `reviewedAt` 2026-08-17)
  - `pr-review-3841.json` — an ordinary complete review: `cost`, `prIntroDraft`, `existingComments`, per-finding `githubUrl`
  - `review-3642-payload.json` — a `{body, comments, event}` document, neither version key → `schema-invalid`

  Derived (each a copy with one stated mutation, recorded in the README):
  - `pr-review-3668-3669.json` — the real file reduced to its first 2 findings with `verdict.counts` left untouched: same-number pair member B (`pr.number: 3668`, `reviewedAt` 2026-07-28) **and** the counts-mismatch display-note case
  - `pr-review-unsupported-version.json` — `pr-review-3841.json` with `version: 2`
  - `pr-review-missing-reviewed-at.json` — `pr-review-3668.json` with `pr.reviewedAt` deleted
  - `pr-review-bad-enum.json` — `pr-review-3841.json` with one finding's `severity` set to `blocker`
  - `pr-review-file-url.json` — `pr-review-3841.json` with one finding's `githubUrl` set to `file:///etc/passwd`
  - `pr-review-malformed.json` — a `pr-review-3841.json` prefix truncated mid-object

  Directory noise, reproducing the real corpus:
  - `pr-report-3841.html` — a stub HTML file
  - `3642/` — a directory containing one file

- Produces: `tests/fixtures/pr-report/composer-logic.js` and, in Task 7, a pinned sha256 of it.

**Behavior:**
- `pr-fixtures.test.ts` asserts the inventory: exactly 11 `*.json` files, one `.html` file and one subdirectory; every file the plan names is present.
- Each verbatim fixture is byte-identical to its corpus source at vendoring time (asserted only by review, not by a test that reads the corpus).
- Each derived fixture parses as JSON except `pr-review-malformed.json`, which must not.
- Findings inside every ok fixture retain the schema's 8 required per-finding fields — the mutations touch only what the README names.
- No test in the repo references an absolute path outside the repo.

**Verify:**
- Run: `npx vitest run tests/main/pr-fixtures.test.ts`
- Expected: green; `git status` shows only additions under `tests/fixtures/`.

---

### Task 3: Shared contract — types, channels, API surface, preload

**Repo:** `/Users/alvarocarvalho/desenv/personal/forge`

**Files:**
- Modify: `src/shared/types.ts`, `src/shared/ipc-channels.ts`, `src/shared/forge-api.ts`, `src/main/preload.ts`
- Test: `tests/shared/ipc-channels.test.ts` (extend), `tests/shared/types.test.ts` (extend), `tests/main/preload.test.ts` (extend)

**Interfaces:**
- Produces (`src/shared/ipc-channels.ts`, appended to the existing `IpcChannel` object, verbatim):
  ```ts
  PrListReviews: 'pr:list-reviews',
  PrGetReview: 'pr:get-review',
  PrGetTriage: 'pr:get-triage',
  PrSetTriage: 'pr:set-triage',
  AppOpenExternal: 'app:open-external',
  ```
- Produces (`src/shared/types.ts`, verbatim — `PrFinding`/`PrFindings` mirror `~/.agent-skills/pr-review/schema.md` v1, no more and no less):
  ```ts
  export interface PrCounts { critical: number; major: number; minor: number; nit: number }

  export type PrSeverity = 'critical' | 'major' | 'minor' | 'nit';
  export type PrCategory = 'bug' | 'security' | 'perf' | 'tests' | 'api-contract' | 'style' | 'docs';
  export type PrConfidence = 'verified' | 'high' | 'medium' | 'low';
  export type PrVerdictStatus = 'merge-ready' | 'needs-work' | 'blocked';
  export type PrSource = 'github' | 'local-branch';
  export type PrCi = 'passing' | 'failing' | 'pending' | 'unknown';

  export interface PrFinding {
    id: string;
    severity: PrSeverity;
    category: PrCategory;
    confidence: PrConfidence;
    title: string;
    file: string;
    body: string;
    agentPrompt: string;
    line?: number | null;
    endLine?: number | null;
    failureScenario?: string | null;
    snippet?: string | null;
    suggestedFix?: string | null;
    githubUrl?: string | null;
    prCommentDraft?: string | null;
    inline?: boolean;
  }

  export interface PrExistingComment {
    author: string; file: string; line: number; body: string; createdAt: string;
  }

  export interface PrCost {
    agents?: number; totalTokens?: number; durationMs?: number;
    model?: string; estimatedUsd?: number; note?: string;
  }

  /** The parsed schema-v1 document. The version key is normalised to `version: 1`;
   *  unknown fields are preserved and ignored. `schema.md` is canonical. */
  export interface PrFindings {
    version: 1;
    pr: {
      source: PrSource; number: number | null; url: string | null;
      title: string | null; author: string | null; branch: string;
      base: string | null; ci: PrCi; reviewedAt: string;
      filesChanged?: number; additions?: number; deletions?: number;
    };
    verdict: { status: PrVerdictStatus; summary: string; counts: PrCounts };
    prIntroDraft?: string;
    findings: PrFinding[];
    existingComments?: PrExistingComment[];
    cost?: PrCost;
  }

  export type PrTriageState = 'untriaged' | 'accepted' | 'rejected' | 'fixed';
  export type PrRowError =
    | 'unreadable' | 'invalid-json' | 'unsupported-version'
    | 'schema-invalid' | 'missing-reviewed-at';

  export type PrReviewRow =
    | { kind: 'ok'; reviewId: string; repoPath: string; fileName: string; groupKey: string;
        prNumber: number | null; branch: string; title: string | null; source: PrSource;
        status: PrVerdictStatus; counts: PrCounts; findingCount: number;
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
    resetFromReviewedAt?: string;
  }

  export type PrGetReviewResult =
    | { kind: 'ok'; reviewId: string; doc: PrFindings; triage: PrTriageDoc }
    | { kind: 'error'; reviewId: string; reason: PrRowError; detail: string };

  export type PrTriageSaveResult =
    | { ok: true; doc: PrTriageDoc }
    | { ok: false; message: string; doc: PrTriageDoc };
  ```
- Produces (`src/shared/forge-api.ts`, two new namespaces on `ForgeApi`, verbatim):
  ```ts
  pr: {
    listReviews: () => Promise<PrListResult>;
    getReview: (reviewId: string) => Promise<PrGetReviewResult>;
    getTriage: (reviewId: string) => Promise<PrTriageDoc>;
    setTriage: (reviewId: string, findingId: string, state: PrTriageState) => Promise<PrTriageSaveResult>;
  };
  app: { openExternal: (url: string) => Promise<{ ok: boolean }> };
  ```

**Behavior:**
- `preload.ts` wires each method through `ipcRenderer.invoke` with an object-wrapped payload, matching the existing namespaces: `PrGetReview` and `PrGetTriage` send `{ reviewId }`, `PrSetTriage` sends `{ reviewId, findingId, state }`, `AppOpenExternal` sends `{ url }`, `PrListReviews` sends nothing.
- `pr` and `app` are non-optional on `ForgeApi` (unlike `comments`), so every renderer call site is type-checked.
- `ipc-channels.test.ts` asserts the five new literals verbatim; `types.test.ts` asserts the `PrRowError` and `PrTriageState` unions and that a `PrReviewRow` discriminates on `kind`.
- `preload.test.ts` asserts each new method invokes its channel with the exact payload shape.
- No handler exists yet — this task adds no runtime behaviour beyond the bridge.

**Verify:**
- Run: `npx vitest run tests/shared tests/main/preload.test.ts && npm run typecheck && npm run lint`
- Expected: green; `npm run typecheck` proves the new types compile in main, renderer and test projects.

---

### Task 4: `pr-findings-schema.ts` — validate and normalise one document

**Repo:** `/Users/alvarocarvalho/desenv/personal/forge`

**Files:**
- Create: `src/main/services/pr-findings-schema.ts`
- Test: `tests/main/pr-findings-schema.test.ts`

**Interfaces:**
- Consumes: `PrFindings`, `PrRowError` (Task 3); fixtures (Task 2).
- Produces:
  ```ts
  export type PrParseResult =
    | { kind: 'ok'; doc: PrFindings; countsMismatch: boolean }
    | { kind: 'error'; reason: PrRowError; detail: string };

  export function parseFindingsDocument(raw: string): PrParseResult;
  ```

**Behavior:**
- Unparseable JSON → `invalid-json` with the parser's message in `detail`.
- Parsed value that is not a non-null object, or an object carrying neither `version` nor `schemaVersion` → `schema-invalid` with detail naming the missing version key (`review-3642-payload.json` lands here).
- Either version key present but not the number `1` → `unsupported-version` with detail naming the value, e.g. `version 2 is not supported`. The value is never coerced.
- `schemaVersion: 1` is accepted and the returned `doc.version` is `1`; the original `schemaVersion` key is preserved on the object but not read again.
- Missing or non-object `pr`, missing `pr.branch`, `verdict.status` outside the enum, missing `verdict.counts`, or `findings` not an array → `schema-invalid` naming the offending path.
- `pr.reviewedAt` missing, not a string, or empty/whitespace → `missing-reviewed-at` (checked after the structural checks so a non-findings document never reports it).
- Every finding must carry the schema's 8 required fields with `severity`, `category` and `confidence` inside their enums; the first violation → `schema-invalid` naming the finding id (or index when `id` is absent) and the field. `pr-review-bad-enum.json` exercises this.
- `findings: []` is valid (`pr-review-ful-85-time-off-timezones.json`).
- Missing optional `pr` fields are normalised to `null` (`pr.title` on the demo file, `pr.number` on both local-branch files) rather than left `undefined`; `pr.ci` defaults to `'unknown'`.
- Unknown fields at any level are preserved on the returned object and never rejected — the demo file's per-finding `sourcePath`/`verifyNote` round-trip.
- `countsMismatch` is `true` when `verdict.counts` per severity differs from the actual findings tally, and never turns the result into an error. `pr-review-3668-3669.json` is `ok` with `countsMismatch: true`; every other ok fixture is `false`.

**Verify:**
- Run: `npx vitest run tests/main/pr-findings-schema.test.ts && npm run typecheck && npm run lint`
- Expected: one named case per bullet, each fed by a fixture file read from `tests/fixtures/pr-review/`.

---

### Task 5: `pr-findings-reader.ts` — scan set, identity, ordering

**Repo:** `/Users/alvarocarvalho/desenv/personal/forge`

**Files:**
- Create: `src/main/services/pr-findings-reader.ts`
- Test: `tests/main/pr-findings-reader.test.ts`

**Interfaces:**
- Consumes: `parseFindingsDocument` (Task 4), `expandHome` (`src/main/lib/paths.ts`), `PrListResult`, `PrReviewRow`, `PrGetReviewResult` (Task 3).
- Produces:
  ```ts
  export interface PrFindingsReader {
    list(): Promise<PrListResult>;
    resolve(reviewId: string): { repoPath: string; filePath: string; fileName: string } | null;
    read(reviewId: string): Promise<{ kind: 'ok'; doc: PrFindings } | { kind: 'error'; reason: PrRowError; detail: string }>;
  }
  export interface PrFindingsReaderDeps {
    getConfig: () => Promise<Pick<AppConfig, 'repoPath' | 'computronRepoPath'>>;
  }
  export function createPrFindingsReader(deps: PrFindingsReaderDeps): PrFindingsReader;
  export function reviewIdFor(realRepoPath: string, fileName: string): string;
  ```

**Behavior:**
- **Scan set:** `[computronRepoPath, repoPath]` in that order → drop empty strings → `expandHome` → `realpath` → dedupe preserving first occurrence. A path that does not resolve is reported in `repos` as `{ scanned: false, message: 'Path not found' }`; one that resolves but has no `.pr-review` directory as `{ scanned: false, message: 'No .pr-review directory' }`. Both configured paths pointing at the same clone yield one entry.
- **File filter:** only regular files whose name ends in `.json`, directly inside `<repo>/.pr-review/`. `pr-report-*.html` and the `3642/` subdirectory are skipped silently and never appear as rows.
- **`reviewIdFor`** = the first 16 hex characters of `sha256(realRepoPath + "\0" + fileName)`. It is derived from the realpath, so two clones of one repo produce different ids and therefore separate triage.
- A file that cannot be read (permissions, disappeared mid-scan) → an `error` row with reason `unreadable`; every other error reason comes from `parseFindingsDocument`.
- **Row shape:** `groupKey = String(pr.number ?? pr.branch ?? fileName)`. `findingCount` is the actual array length, `counts` is the document's `verdict.counts` as written, and `countsMismatch` comes from the parse result.
- **Ordering:** ok rows are grouped by `groupKey`; within a group, `reviewedAt` descending; groups ordered by their newest `reviewedAt` descending. Ties (identical `reviewedAt`) break on `fileName` ascending so the order is deterministic. `list()` returns a flat array already in that order, with all error rows appended after every ok row.
- Against the fixture directory: `pr-review-3668.json` and `pr-review-3668-3669.json` share `groupKey` `3668` with the 2026-08-17 file first; `pr-review-ful-85-*.json` is an ok row with `findingCount: 0`; the four invalid fixtures plus `review-3642-payload.json` are the trailing error rows; total rows = 11.
- **`resolve`/`read`** consult a `reviewId → { repoPath, filePath, fileName }` map rebuilt on every `list()` call. `resolve` returns `null` for an unknown id; `read` returns `{ kind: 'error', reason: 'unreadable', detail: 'Unknown review id — refresh the list.' }`. No path derived from caller input ever reaches the filesystem.
- `list()` on an empty scan set returns `{ rows: [], repos: [] }` and does not throw.

**Verify:**
- Run: `npx vitest run tests/main/pr-findings-reader.test.ts && npm run typecheck && npm run lint`
- Expected: green with `getConfig` injected to point at `tests/fixtures/pr-review/`'s parent (a temp dir containing a `.pr-review` symlink or copy — the test creates it), and the unknown-id case asserted before any `list()` call.

---

### Task 6: `pr-triage-store.ts` — durable, atomic, reset-aware triage

**Repo:** `/Users/alvarocarvalho/desenv/personal/forge`

**Files:**
- Create: `src/main/services/pr-triage-store.ts`
- Modify: `src/main/lib/paths.ts`
- Test: `tests/main/pr-triage-store.test.ts`, `tests/main/paths.test.ts` (extend)

**Interfaces:**
- Consumes: `PrTriageDoc`, `PrTriageState`, `PrTriageSaveResult` (Task 3).
- Produces:
  ```ts
  // src/main/lib/paths.ts
  export function prTriageDir(): string;            // <homedir>/.forge/pr-triage

  // src/main/services/pr-triage-store.ts
  export interface PrTriageStore {
    load(reviewId: string, reviewedAt: string): Promise<PrTriageDoc>;
    set(reviewId: string, reviewedAt: string, findingId: string, state: PrTriageState): Promise<PrTriageSaveResult>;
  }
  export function createPrTriageStore(dir?: string): PrTriageStore;  // defaults to prTriageDir()
  ```

**Behavior:**
- Documents live at `<dir>/<reviewId>.json`. `load` on a missing or unreadable file returns a fresh document — `triageVersion: 1`, the given `reviewId` and `reviewedAt`, `states: {}`, `updatedAt` set to now — without writing anything to disk.
- A stored document whose `reviewedAt` differs from the one passed in is treated as a new review run: `states` reset to `{}`, `resetFromReviewedAt` set to the **stored** value, `reviewedAt` updated. The reset document is returned but not persisted until the next `set`, so merely opening a re-reviewed PR writes nothing.
- A stored document with an unexpected `triageVersion`, or that fails to parse, is discarded like a missing file — triage is recoverable state, never a hard error.
- `set` loads (applying the reset rule), applies `states[findingId] = state`, deletes the key instead when `state` is `'untriaged'` so cleared findings do not accumulate, refreshes `updatedAt`, and writes.
- Writes are whole-file and atomic: `mkdir -p` the directory, write `<reviewId>.json.tmp-<pid>-<random>` in the same directory, then `rename` over the target. A failed write leaves no temp file behind.
- A write failure (read-only directory) resolves `{ ok: false, message, doc }` where `doc` is the last known good document — the state as it was before the attempted change — and never throws.
- A successful write resolves `{ ok: true, doc }` with the document as persisted.
- `postedAt` is never written in Phase 1 but is preserved verbatim when present in a stored document.
- `paths.test.ts` asserts `prTriageDir()` ends in `.forge/pr-triage` and is a child of `forgeDir()`.

**Verify:**
- Run: `npx vitest run tests/main/pr-triage-store.test.ts tests/main/paths.test.ts && npm run typecheck && npm run lint`
- Expected: green against a temp directory; the failure case uses `chmod 0o500` on the temp dir and restores permissions in teardown.

---

### Task 7: `pr-prompt.ts` — mirrored derived text with a byte-equality oracle

**Repo:** `/Users/alvarocarvalho/desenv/personal/forge`

**Files:**
- Create: `src/shared/pr-prompt.ts`
- Test: `tests/shared/pr-prompt.test.ts`
- Depends on: `tests/fixtures/pr-report/composer-logic.js` (Task 2, produced by Task 1)

**Interfaces:**
- Consumes: `PrFinding`, `PrFindings` (Task 3).
- Produces:
  ```ts
  export function findingLocation(f: Pick<PrFinding, 'file' | 'line'>): string;
  export function agentPromptFor(f: PrFinding): string;
  export function draftFor(f: PrFinding, edits?: Record<string, string>): string;
  ```

**Behavior:**
- `agentPromptFor` reproduces `template.html`'s function exactly: a header, then the non-empty sections `Finding details` (`body`), `Failure scenario` (`failureScenario`) and `Suggested fix` (`suggestedFix`), each rendered as `<Label>:\n<trimmed text>`, joined by `\n\n`; empty or non-string sections are dropped.
- The header is `agentPrompt.trim()` when it is a non-empty string, else the fallback `Review and address this <severity> finding in <file:line>: <title>.` — with `review` substituted for a missing severity and `Untitled finding` for a missing title.
- `findingLocation` yields `file:line` when `line` is non-null and bare `file` otherwise.
- `draftFor` precedence is `edits` → `prCommentDraft` → fallback, where a **present** `edits` key wins even when its value is the empty string; the fallback is the title with trailing periods stripped, plus `.`, plus ` Suggested fix: <suggestedFix>` when a fix is present, never truncated.
- **Byte-equality test:** `tests/shared/pr-prompt.test.ts` loads `tests/fixtures/pr-report/composer-logic.js` into a `node:vm` context with no DOM globals, then asserts `agentPromptFor` and `draftFor` return strings identical to the oracle's for every finding in every ok fixture, plus the constructed edge cases: `agentPrompt` absent; `agentPrompt` blank whitespace; `line` null; `body`/`failureScenario`/`suggestedFix` each absent; `edits` key present-and-empty; `prCommentDraft` present; title with a trailing period.
- **Pinned hash:** the test asserts `sha256(tests/fixtures/pr-report/composer-logic.js)` equals a `COMPOSER_LOGIC_SHA256` constant declared in the test file, with a failure message instructing the reader to re-vendor the file from `~/.agent-skills/pr-report/composer-logic.js` and re-run the equality assertions.
- The vendored oracle is test-only: nothing under `src/` imports it, and it is not referenced by `electron-vite`'s build.

**Verify:**
- Run: `npx vitest run tests/shared/pr-prompt.test.ts && npm run typecheck && npm run lint`
- Expected: green; deliberately mutating one character of `pr-prompt.ts`'s fallback header makes the equality test fail, and touching the vendored oracle makes the hash test fail.

---

### Task 8: IPC handlers, external links, and registration

**Repo:** `/Users/alvarocarvalho/desenv/personal/forge`

**Files:**
- Create: `src/main/ipc/pr-review.ts`, `src/main/ipc/app.ts`
- Modify: `src/main/ipc/register.ts`, `src/main/index.ts`
- Test: `tests/main/ipc-pr-review.test.ts`, `tests/main/ipc-app.test.ts`, `tests/main/register.test.ts` (extend)

**Interfaces:**
- Consumes: `createPrFindingsReader` (Task 5), `createPrTriageStore` (Task 6), the five channels (Task 3).
- Produces:
  ```ts
  // src/main/ipc/pr-review.ts
  export interface PrReviewDeps { reader: PrFindingsReader; triage: PrTriageStore }
  export function registerPrReviewHandlers(ipc: IpcMain, deps: PrReviewDeps): void;

  // src/main/ipc/app.ts
  export interface AppOpenExternalDeps { openExternal: (url: string) => Promise<void> }
  export function registerAppOpenExternalHandler(ipc: IpcMain, deps: AppOpenExternalDeps): void;
  export function isAllowedExternalUrl(url: string): boolean;
  ```

**Behavior:**
- `pr:list-reviews` returns `reader.list()` unchanged. It is the only channel that rebuilds the id map, so it is also the refresh path.
- `pr:get-review` reads the document, then loads triage for that `reviewId` using the document's `pr.reviewedAt`, and returns `{ kind: 'ok', reviewId, doc, triage }`. A reader error is returned as `{ kind: 'error', reviewId, reason, detail }` — the handler never throws for a bad id or a bad file.
- `pr:get-triage` resolves the id to its file, reads the document only for its `reviewedAt`, and returns the triage document; an unknown id resolves a fresh empty document rather than rejecting, since triage absence is not an error.
- `pr:set-triage` writes through the store and returns `PrTriageSaveResult`; the `reviewedAt` it passes comes from the document on disk, so a re-review discovered between list and click still resets rather than merging.
- `app:open-external` calls `isAllowedExternalUrl` first: `new URL(url)` must yield `protocol === 'https:'` and `hostname === 'github.com'`. Allowed → `openExternal(url)` then `{ ok: true }`; refused or malformed → `{ ok: false }` with a `console.warn` naming the refused URL, and `openExternal` is not called. `file:///etc/passwd`, `http://github.com/x`, `https://github.com.evil.tld/x` and `javascript:alert(1)` are all refused.
- `register.ts` constructs one reader (with `getConfig: () => store.get()`, so a config change is picked up on the next list) and one triage store, and registers both modules; `index.ts` passes Electron's `shell.openExternal` as the dep and adds `win.webContents.setWindowOpenHandler` returning `{ action: 'deny' }` so a target-blank link inside the renderer can never open a Forge window.
- `register.test.ts` asserts all five new channels are registered exactly once.

**Verify:**
- Run: `npx vitest run tests/main/ipc-pr-review.test.ts tests/main/ipc-app.test.ts tests/main/register.test.ts && npm run typecheck && npm run lint`
- Expected: green with a fake `IpcMain` in the style of the existing `ipc-*.test.ts` files and injected reader/store/openExternal doubles.

---

### Task 9: Renderer — Reviews mode, findings view, triage

**Repo:** `/Users/alvarocarvalho/desenv/personal/forge`

**Files:**
- Create: `src/renderer/hooks/use-pr-reviews.ts`, `src/renderer/hooks/use-pr-triage.ts`
- Create: `src/renderer/components/pr/pr-list-panel.tsx`, `pr-review-view.tsx`, `verdict-header.tsx`, `finding-filters.tsx`, `finding-card.tsx`, `existing-comments.tsx`
- Modify: `src/renderer/app.tsx`, `src/renderer/components/top-bar.tsx`, `src/renderer/styles/tokens.css`
- Test: `tests/renderer/use-pr-reviews.test.ts`, `tests/renderer/use-pr-triage.test.ts`, `tests/renderer/pr-list-panel.test.tsx`, `tests/renderer/pr-review-view.test.tsx`, `tests/renderer/finding-card.test.tsx`, `tests/renderer/app.test.tsx` (extend), `tests/renderer/top-bar.test.tsx` (extend)

**Interfaces:**
- Consumes: `window.forge.pr.*`, `window.forge.app.openExternal` (Task 3), `agentPromptFor` (Task 7).
- Produces:
  ```ts
  export type PrMode = 'issues' | 'reviews';

  export function usePrReviews(active: boolean): {
    rows: PrReviewRow[];
    repos: PrListResult['repos'];
    selected: PrGetReviewResult | null;
    isLoading: boolean;
    select: (reviewId: string) => void;
    refresh: () => Promise<void>;
  };

  export function usePrTriage(selected: PrGetReviewResult | null): {
    states: Record<string, PrTriageState>;
    wasReset: boolean;
    errorMessage: string | null;
    setState: (findingId: string, next: PrTriageState) => Promise<void>;
  };
  ```
  `top-bar.tsx` gains `mode: PrMode` and `onModeChange: (next: PrMode) => void`; its existing props are unchanged.

**Behavior:**
- **Mode switch.** `TopBar` renders an `Issues | Reviews` control. Entering Reviews closes any open drawer and triggers a list refresh; returning to Issues restores the previously selected issue and drawer tab from a ref. The auth strip and last-sync stamp stay in `TopBar` in both modes.
- **Layout.** In Reviews mode `app.tsx` renders `PrListPanel` and `PrReviewView` into the existing two `.zones` children; `IssueListPanel` and `RightPanel` are not mounted. The 40/60 grid in `tokens.css` is unchanged — no new grid, no new breakpoint.
- **`usePrReviews`** calls `listReviews` on activation and on `refresh`, then `getReview` for the selected id — always list-before-read, satisfying the reader's id-map rule. A stale `getReview` response for a row the user has since navigated away from is discarded. It selects the first ok row automatically on first load and never auto-selects an error row.
- **List panel.** One row per file, grouped by `groupKey` in the order main returned, with the group's key as its header. Each row shows severity counts, verdict status, relative `reviewedAt`, and **always** the file name. Error rows render in a trailing `Unreadable` group showing the file name and the reason's human label, are never hidden by any filter, and are not selectable. A repo reported `scanned: false` renders its `message` as a muted note above the list. Empty scan set renders `No repositories with a .pr-review directory are configured.`
- **Verdict header.** Status, `verdict.summary`, counts, `pr` metadata (number or branch, author, base, CI, files/additions/deletions when present) and the `cost` line when present. `countsMismatch` renders a muted note — `Counts in the file disagree with its findings.` — not an error. `wasReset` renders the banner `New review run — triage was reset.`
- **Filters.** Four chip families — severity, category, file, and a `verified only` confidence toggle — plus a triage-state filter. Filters combine as AND across families and OR within one. Rejected findings dim but stay visible unless the triage filter excludes them. A filter combination matching nothing renders an explicit empty state, distinct from a clean review.
- **Critical strip.** Pinned above the list of cards when any `critical` finding exists; clicking an entry scrolls its card into view and focuses it.
- **Finding cards.** Title, severity/category/confidence badges, location, `body`, `failureScenario`, `snippet` (monospace `<pre>`, no diff colouring), `suggestedFix`, a `githubUrl` link routed through `window.forge.app.openExternal` (never a bare `<a href>`), the tri-state triage control, and a `Copy agent prompt` button using `agentPromptFor`. Cards default expanded for `critical`/`major` and collapsed for `minor`/`nit`. The copy button shows `Copied` for 1.5s.
- **Triage.** Clicking `accepted`/`rejected`/`fixed` sets it; clicking the currently active state returns the finding to `untriaged`. `usePrTriage` updates optimistically, and on `{ ok: false }` reverts to the returned `doc.states` and surfaces `message` inline near the finding. Progress reads `<triaged> / <total>` in the verdict header.
- **Zero findings** renders a clean-review state — the verdict header plus `No findings — this review is clean.` — never an empty list with filter chips.
- **Existing comments** render read-only below the findings, collapsed by default, and are omitted entirely when absent.
- Tests drive the hooks and components against a stubbed `window.forge` in the existing `tests/renderer` style; no test reaches the filesystem.

**Verify:**
- Run: `npx vitest run tests/renderer && npm run typecheck && npm run lint`
- Expected: existing renderer suites still green; new suites cover mode switching and state retention, list grouping and the unreadable group, the reset banner, optimistic-update rollback, the tri-state click-to-clear, and the refused-URL path.
- Manual: `npm run dev`, switch to Reviews with `computronRepoPath` set — walk the checklist below.

---

## Validation

Run from `/Users/alvarocarvalho/desenv/personal/forge` (the repo is npm-managed — `package-lock.json`, no pnpm lockfile; substitute `pnpm` only if the repo migrates):

```
npm run typecheck
npm test
npm run format:check
```

Also run per task, and once at the end: `npm run lint` and `npm run build`.

Upstream, from `~/.agent-skills/pr-report`: `node --test test_composer.mjs && python3 -m unittest test_build -v`.

### Final validation checklist

- [ ] `npm run typecheck && npm test && npm run format:check && npm run lint && npm run build` — all green.
- [ ] Success criterion 1 — with `computronRepoPath` pointed at the real clone, Reviews lists one row per findings JSON present (15 at time of writing, out of 16 `*.json` files); `review-3642-payload.json` appears as an errored `schema-invalid` row and never as an ok row; no `pr-report-*.html` file and no `3642/` entry appears at all.
- [ ] Success criterion 2 — `pr-review-demo-void-time-entry.json` renders as a normal ok row with 8 findings, no `pr.number`, and no title.
- [ ] Success criterion 3 — `pr-review-3668.json` and `pr-review-3668-3669.json` are two rows in one group, newest first, each labelled with its file name.
- [ ] Success criterion 4 — `pr-review-ful-85-time-off-timezones.json` renders the clean-review state with zero findings and no error.
- [ ] Success criterion 5 — the `version: 2` and malformed-JSON fixtures each produce exactly one errored row naming the file and the reason.
- [ ] Success criterion 6 — triage set on a finding survives quit and restart; rewriting the JSON with a new `reviewedAt` resets states and shows `New review run — triage was reset.`
- [ ] Success criterion 7 — with `~/.forge/pr-triage` `chmod 0o500`, clicking a triage state shows an inline error and the control reverts to its prior state.
- [ ] Success criterion 8 — clicking a `githubUrl` opens the system browser; the `file://` fixture is refused, logs, and opens nothing.
- [ ] Mutating one character of `pr-prompt.ts`'s fallback header fails the byte-equality test; touching the vendored oracle fails the pinned-hash test.
- [ ] A report built by `pr-report/build.py` after Task 1 is functionally identical to one built before it.
- [ ] Switching Issues → Reviews → Issues restores the prior issue selection and drawer tab.
- [ ] `thoughts/tech-debt.md` has entries for: `getTriage` unused by the Phase 1 renderer, `draftFor` exported ahead of Phase 4, and no diff colouring on `snippet`.
- [ ] Per-task `progress.md`, `spec-review.md`, `qa-review.md` exist under `thoughts/tasks/pr-review-surface/impl/task-<N>/`, and `impl/final-review.md` is written.

---

## Out of scope — Phases 2 and 3 (and 4, 5)

Not planned here, and not to be built opportunistically while implementing Phase 1:

- **Phase 2 — review queue via `gh`.** `gh-client.ts`, the two `gh pr list` invocations, `pr-queue.json` caching, `gh` in `AuthStatus` / `top-bar.tsx` / `right-panel.tsx` / `auth-checker.ts`, the `cwd` + `timeoutMs` additions to `src/main/lib/exec.ts`, and the `pr.reviewedHeadSha` staleness signal.
- **Phase 3 — launching a review run.** The Codex preflight probe, the external-AI consent dialog, the delivery-choice question, `pr-review-runner.ts`, and the `SKILL.md` pre-answer + abort sentence without which Phase 3 does not ship.
- **Phase 4 — comment composer and posting.** `pr-comment-poster.ts`, `introFor` / `bulletFor` / `buildFullComment` / `buildReviewPayload` in the renderer, editable drafts, `postedAt`, `Copy gh review command`, `Copy as agent task`.
- **Phase 5 — findings → agent handoff**, and the config UI.

**What those phases will need from Phase 1, already provided by it:**

- Phase 2 joins its queue rows to reviews on `pr.number`, which `PrReviewRow.prNumber` exposes (null for local-branch reviews, which are excluded from the join by construction), and links to a group's newest row via `reviewId`. It needs no change to the reader, and adding `reviewedHeadSha` to the schema requires nothing from Forge — `parseFindingsDocument` already preserves unknown fields.
- Phase 3 re-scans by calling `pr:list-reviews` after a run completes and selects the new `reviewId`; the reader rebuilding its id map on every list is what makes that safe.
- Phase 4 reuses `PrTriageDoc.postedAt` (already preserved by the store), the `accepted` triage state, and `src/shared/pr-prompt.ts` — where `draftFor` and the pinned oracle are already in place, so the composer is a port of `introFor`/`bulletFor`/`buildReviewPayload` against the same hash. It also needs `exec.ts`'s `cwd` from Phase 2.
- Phase 5 reuses `agentPromptFor` for the batch prompt and the `accepted` state as its selection, and waits on the Agent Runner that does not exist yet.

**Open decisions deferred to the implementer:** none. Card-level detail (collapse defaults, copy feedback, snippet rendering, strip navigation), fixture placement, the oracle-vendoring strategy and the external-URL check are all decided above.
