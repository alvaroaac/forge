# PR 4 Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or execute this plan task-by-task with TDD. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Patch PR #4 so the comment-context pipeline has a main-process trust boundary, fails open when comment enrichment breaks, guards stale renderer results, sanitizes generated markdown links, and keeps comment-triage timeouts short.

**Architecture:** Renderer may request comment operations by issue id, but main process owns issue lookup, Linear UUID selection, comment filtering, and summary inputs. Comment context is enrichment for spec/brief generation, so failures must degrade to no comment context instead of aborting the core generation. Renderer UI must ignore late async results that belong to an old issue.

**Tech Stack:** Electron IPC, React + TypeScript, Vitest, Testing Library.

---

## Review Findings To Fix

Huygens found these issues:

1. `src/main/ipc/comments.ts` trusts renderer-provided `Issue` objects and their `uuid`.
2. `src/main/ipc/comments.ts` trusts renderer-provided comments for summary generation.
3. `src/main/ipc/spec.ts` and `src/main/ipc/triage.ts` can abort generation if comment fetch fails.
4. `src/renderer/components/comments-tab.tsx` can apply a stale summary result after switching issues.
5. Generated markdown links can render unsafe schemes such as `javascript:` or `file:`.
6. Comment triage inherits the 10 minute spec-generation timeout.

## Files

- Modify: `src/shared/forge-api.ts`
- Modify: `src/main/preload.ts`
- Modify: `src/main/ipc/comments.ts`
- Modify: `src/main/ipc/spec.ts`
- Modify: `src/main/ipc/triage.ts`
- Modify: `src/main/services/spec-generator.ts`
- Modify: `src/main/services/comment-triager.ts`
- Modify: `src/renderer/components/comments-tab.tsx`
- Modify: `src/renderer/components/markdown-inline.tsx`
- Modify tests:
  - `tests/main/ipc-comments.test.ts`
  - `tests/main/ipc-spec-generate.test.ts`
  - `tests/main/ipc-triage.test.ts`
  - `tests/main/spec-generator.test.ts`
  - `tests/renderer/comments-tab.test.tsx`
  - existing markdown renderer test file, likely `tests/renderer/markdown.test.tsx`
  - preload/API tests as needed

## Task 1: Make Comments IPC Main-Owned

- [ ] Write failing IPC tests in `tests/main/ipc-comments.test.ts`.
  - A payload with `issueId: "FUL-7"` and a spoofed `issue.uuid` must not cause `fetchAndFilterComments` to receive the spoofed UUID.
  - `generateSummary` must not accept renderer-supplied comments as the summary input.
  - Expected behavior: comments handlers resolve issue data from main-owned cache.

- [ ] Change the shared API in `src/shared/forge-api.ts`.
  - Prefer this shape:

```ts
comments?: {
  fetch(issueId: string): Promise<CommentFetchResult>;
  generateSummary(issueId: string): Promise<CommentSummaryResult>;
};
```

- [ ] Change `src/main/preload.ts` so renderer passes only `issueId`.

- [ ] Change `src/main/ipc/comments.ts`.
  - Remove authoritative use of `payload.issue`.
  - Remove authoritative use of `payload.comments`.
  - `findIssue` should only accept `(issues, issueId)`.
  - `fetch` should read cache, find issue by safe issue id, require `issue.uuid`, then call `fetchAndFilterComments(issue.uuid)`.
  - `generateSummary` should read cache, find issue by safe issue id, require `issue.uuid`, fetch/filter comments in main, then call `triageComments` with main-owned title, description, and comments.

- [ ] Update `src/renderer/components/comments-tab.tsx`.
  - `window.forge.comments.fetch(issue.id)`
  - `window.forge.comments.generateSummary(issue.id)`

- [ ] Run:

```bash
npm test -- tests/main/ipc-comments.test.ts tests/main/preload.test.ts tests/renderer/comments-tab.test.tsx
```

Expected: all pass.

## Task 2: Fail Open When Comment Context Breaks

- [ ] Write failing tests.
  - In `tests/main/ipc-spec-generate.test.ts`, make `fetchAndFilterComments` reject and assert spec generation still resolves successfully.
  - In `tests/main/ipc-triage.test.ts`, make `fetchAndFilterComments` reject and assert brief generation still resolves successfully.

- [ ] Patch `src/main/ipc/spec.ts` and `src/main/ipc/triage.ts`.
  - Wrap the full comment-context phase in best-effort handling:
    - fetch comments
    - if comments exist, triage comments
    - if either step throws, continue with empty comment context
  - Do not swallow the actual spec/brief generator failure.

- [ ] Run:

```bash
npm test -- tests/main/ipc-spec-generate.test.ts tests/main/ipc-triage.test.ts
```

Expected: all pass.

## Task 3: Guard Stale Comments Summary Results

- [ ] Write failing test in `tests/renderer/comments-tab.test.tsx`.
  - Render `CommentsTab` for issue A with comments loaded.
  - Click generate summary and leave the promise pending.
  - Rerender for issue B before issue A summary resolves.
  - Resolve issue A summary.
  - Assert issue A summary/comments do not appear for issue B.

- [ ] Patch `src/renderer/components/comments-tab.tsx`.
  - Track current issue id with `useRef`.
  - Update it in an effect when `issue.id` changes.
  - In `handleGenerateClick`, capture `requestIssueId = issue.id`.
  - After `generateSummary` resolves, return early unless `currentIssueIdRef.current === requestIssueId` and `nextResult.issueId === requestIssueId`.
  - Also avoid applying caught errors for stale requests.

- [ ] Run:

```bash
npm test -- tests/renderer/comments-tab.test.tsx tests/renderer/triage-drawer-comments-tab.test.tsx
```

Expected: all pass.

## Task 4: Sanitize Generated Markdown Links

- [ ] Find markdown link rendering in `src/renderer/components/markdown-inline.tsx`.

- [ ] Write failing test in the existing markdown renderer test.
  - Render markdown containing `[bad](javascript:alert(1))`.
  - Assert there is no anchor with `href="javascript:alert(1)"`.
  - Render `[good](https://example.com)` and assert the safe link remains.

- [ ] Implement a small allowlist helper.
  - Allow relative links if existing behavior depends on them, otherwise allow only `http:`, `https:`, and `mailto:`.
  - Block `javascript:`, `file:`, `data:`, and unknown schemes.
  - Render blocked links as plain text or as an anchor without `href`; prefer plain text if local patterns allow it.

- [ ] Run:

```bash
npm test -- tests/renderer/markdown.test.tsx tests/renderer/comments-tab.test.tsx
```

Expected: all pass.

## Task 5: Split Comment Triage Timeout

- [ ] Add or update tests in `tests/main/spec-generator.test.ts`.
  - Assert regular spec generation still uses `GENERATE_SPEC_TIMEOUT_MS`.
  - Assert comment triage uses a separate `COMMENT_TRIAGE_TIMEOUT_MS`.

- [ ] Patch timeout constants.
  - Keep `GENERATE_SPEC_TIMEOUT_MS = 600_000`.
  - Add `COMMENT_TRIAGE_TIMEOUT_MS = 60_000`.
  - Use `COMMENT_TRIAGE_TIMEOUT_MS` for comment triage calls in `src/main/services/comment-triager.ts` or the service boundary that calls it.

- [ ] Run:

```bash
npm test -- tests/main/spec-generator.test.ts tests/main/comment-triager.test.ts
```

Expected: all pass.

## Task 6: Verification And PR Update

- [ ] Run focused tests:

```bash
npm test -- tests/main/ipc-comments.test.ts tests/main/ipc-spec-generate.test.ts tests/main/ipc-triage.test.ts tests/renderer/comments-tab.test.tsx tests/renderer/triage-drawer-comments-tab.test.tsx tests/renderer/markdown.test.tsx tests/main/spec-generator.test.ts tests/main/comment-triager.test.ts
```

- [ ] Run full verification:

```bash
npm run typecheck
npm test
npm run lint
npm run package:app
git diff --check
```

- [ ] Commit changes with:

```bash
git add src tests
git commit -m "fix: harden comment context pipeline"
```

- [ ] Do not push or post to GitHub unless the coordinator explicitly asks.

## Self-Review Checklist

- [ ] Renderer cannot choose a Linear UUID for comments.
- [ ] Renderer cannot choose the raw comments summarized by main.
- [ ] Comment context failure does not block spec/brief generation.
- [ ] Late issue A summary cannot overwrite issue B UI.
- [ ] Unsafe markdown links do not produce unsafe clickable `href`s.
- [ ] Comment triage timeout is shorter than full generation timeout.
- [ ] Tests fail for the mutations listed above before implementation and pass after.
