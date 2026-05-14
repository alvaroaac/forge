# 2026-05-14 Forge v0.1 Plan Review Demo Bridge

## Context

Forge needs a demo-ready `Launch Review` flow. The external `plan-review` CLI/browser UI is a temporary v0.1 bridge, not the long-term architecture. The durable work is the Forge-side review result model, revision prompt/parser, reviewed-spec draft state, and `Review changes` summary UI.

`plan-review` must only collect human feedback. Forge owns model routing and applies the review with the drawer-selected model.

## Non-Negotiable Constraints

- Optimize for demo functionality, not a polished external-process platform.
- Do the durable Forge pieces well: typed review result, tagged model response parser, review summary UI, and revised-spec draft flow.
- Keep the `plan-review` bridge thin and disposable.
- Renderer code must not import Node APIs.
- Intermediate review artifacts must not be written under `thoughts/`.
- The only durable task artifact should be `thoughts/tasks/<issueId>/initial-spec.md`, and only after the user clicks `Write to file`.
- Do not invoke `plan-review -o claude` or pipe directly to Claude/Codex from `plan-review`.
- Unsafe issue ids must be rejected before file writes or process spawning.
- Each task must start with the listed TDD tests unless the implementer documents a concrete reason in `progress.md`.

## Shared Demo Flow

1. User opens a spec and clicks `Launch Review`.
2. Forge writes the cleaned current spec to a temporary `review-input.md`.
3. Forge runs:

   ```bash
   plan-review <review-input.md> \
     --fresh \
     --split-by heading \
     -o file \
     --output-file <plan-review-output.md>
   ```

4. User submits review in the external browser UI.
5. Forge reads `plan-review-output.md`.
6. Forge asks the selected model to return exactly:

   ```text
   <forge_review_summary>
   {
     "verdict": "approved" | "changes_requested",
     "reviewerSummary": "string",
     "commentCount": 0,
     "appliedChanges": ["string"],
     "unresolvedComments": ["string"]
   }
   </forge_review_summary>

   <forge_revised_spec>
   revised spec markdown here
   </forge_revised_spec>
   ```

7. Forge displays the revised spec as an unsaved draft and shows a collapsed `Review changes` section below it.
8. Forge best-effort deletes the temp directory.
9. User clicks `Write to file` to persist only the revised spec markdown.

Failure policy for v0.1:

- Any launch, review, model, parse, or cleanup problem can surface as one user-visible error message.
- Keep the original spec visible on failure.
- Do not build detailed lifecycle diagnostics unless needed to debug the demo.

## Task 1: Durable Review Contract and Revision Parser

### Goal

Build the Forge-side review contract that should survive the later embedded-review refactor.

### Ownership

Shared types plus main-process prompt/parser code and tests. Do not wire renderer UI yet. Do not launch `plan-review` yet.

### Requirements

- Add shared types:
  - `SpecReviewSummary`
  - `SpecReviewResult`
- Summary fields:
  - `verdict: 'approved' | 'changes_requested'`
  - `reviewerSummary: string`
  - `commentCount: number`
  - `appliedChanges: string[]`
  - `unresolvedComments: string[]`
- Add a revision prompt builder that includes:
  - original spec markdown
  - raw `plan-review` feedback
  - instruction to return only the two tagged sections from Shared Demo Flow
- Add a parser for the tagged model response.
- Parser must:
  - reject missing tags
  - reject invalid JSON
  - reject empty revised spec
  - clean markdown fences/preamble from revised spec

### TDD Tests To Write First

- `tests/shared/types.test.ts`: representative `SpecReviewSummary` and `SpecReviewResult` compile with exported types.
- `tests/main/spec-review-revision-prompt.test.ts`: prompt includes original spec, review feedback, and the exact required tags.
- `tests/main/spec-review-response-parser.test.ts`: valid response parses summary and revised spec.
- `tests/main/spec-review-response-parser.test.ts`: missing summary tag rejects.
- `tests/main/spec-review-response-parser.test.ts`: missing revised spec tag rejects.
- `tests/main/spec-review-response-parser.test.ts`: invalid JSON rejects.
- `tests/main/spec-review-response-parser.test.ts`: empty revised spec rejects.
- `tests/main/spec-review-response-parser.test.ts`: fenced revised markdown is cleaned.

### Acceptance Criteria

- Tests pass for the prompt and parser.
- Parser and types are provider-neutral and do not mention `plan-review` internals beyond receiving raw feedback text.
- No renderer behavior changes in this task.

## Task 2: Thin External `plan-review` Bridge and IPC

### Goal

Make `Launch Review` actually run the external `plan-review` UI, read its file output, apply the review with the selected model, and return `SpecReviewResult`.

### Ownership

Electron main, preload/API surface, dependency, and focused tests. Keep this bridge intentionally simple because it is expected to be replaced.

### Requirements

- Add `plan-review` as a dependency.
- Add IPC/preload API:
  - `spec.launchReview(issueId, content, model): Promise<SpecReviewResult>`
- Add a single review status event or simple status callback only if renderer needs it for demo text. Do not build a rich status event system.
- Main handler behavior:
  1. validate issue id
  2. create unique temp directory outside `thoughts/`
  3. write cleaned content to `review-input.md`
  4. spawn `plan-review` with the Shared Demo Flow args
  5. wait for exit
  6. read `plan-review-output.md`
  7. call the selected-model revision operation from Task 1
  8. return `SpecReviewResult`
  9. best-effort delete temp directory in `finally`
- For demo simplicity, collapse CLI cancel/nonzero/missing-output/model/parse failures into a readable thrown error.
- Do not persist the revised spec in this handler.

### TDD Tests To Write First

- `tests/shared/ipc-channels.test.ts`: includes `spec:launch-review`.
- `tests/main/preload.test.ts`: `ForgeApi.spec.launchReview` exists.
- `tests/main/spec-review-bridge.test.ts`: successful run writes cleaned temp input, spawns exact `plan-review` args, reads output, calls revision, returns `SpecReviewResult`, and attempts cleanup.
- `tests/main/spec-review-bridge.test.ts`: unsafe issue id rejects before temp write/spawn.
- `tests/main/spec-review-bridge.test.ts`: nonzero CLI exit rejects and attempts cleanup.
- `tests/main/spec-review-bridge.test.ts`: missing review output rejects and attempts cleanup.
- `tests/main/ipc-spec-review.test.ts`: IPC handler passes issue id, content, and model through to the bridge.
- `tests/main/ipc-spec-review.test.ts`: IPC handler rejects without calling spec persistence.

### Acceptance Criteria

- `Launch Review` main/preload API is callable.
- Bridge tests prove the exact `plan-review` command shape.
- No temp files are intentionally written under `thoughts/`.
- Revised spec is returned as draft content only.
- Cleanup is best-effort; do not overbuild cleanup diagnostics.

## Task 3: Demo Drawer UX and Verification

### Goal

Wire the drawer so the demo flow works: launch review, wait, show revised spec, show summary, and persist only on `Write to file`.

### Ownership

Renderer wiring, summary UI, final verification, and any small integration fixes.

### Requirements

- Replace placeholder `Launch Review` copy behavior.
- `Launch Review` calls `window.forge.spec.launchReview(issueId, cleanedContent, selectedModel)`.
- While awaiting the promise, show one simple status string: `Review in progress...`.
- Disable `Launch Review` while pending.
- On success:
  - replace the displayed spec draft with `SpecReviewResult.content`
  - store `SpecReviewResult.summary`
  - show a collapsed `Review changes` section below the document
- `Review changes` displays:
  - verdict
  - reviewer summary
  - comment count
  - applied changes
  - unresolved comments
- On error:
  - keep the previous spec visible
  - show the error message
- `Write to file` writes only the revised spec markdown, not the summary.

### TDD Tests To Write First

- `tests/renderer/spec-tab.test.tsx`: `Launch Review` calls `onLaunchReview` with displayed cleaned content.
- `tests/renderer/spec-tab.test.tsx`: `Launch Review` is disabled while review is pending.
- `tests/renderer/spec-tab.test.tsx`: pending status text renders.
- `tests/renderer/spec-tab.test.tsx`: `Review changes` is collapsed by default and expands on click.
- `tests/renderer/spec-tab.test.tsx`: expanded summary renders verdict, reviewer summary, comment count, applied changes, and unresolved comments.
- `tests/renderer/app.test.tsx`: successful review result replaces displayed draft content.
- `tests/renderer/app.test.tsx`: failed review keeps previous content visible.
- `tests/renderer/app.test.tsx`: `Write to file` after review writes only revised spec content.

### Acceptance Criteria

- Focused renderer tests pass.
- `npm run typecheck` passes.
- `npm test` passes, or unrelated pre-existing failures are documented.
- Manual demo verification:
  1. open a generated spec
  2. click `Launch Review`
  3. add a comment in `plan-review`
  4. submit
  5. see revised spec in Forge
  6. expand `Review changes`
  7. click `Write to file`
  8. verify `initial-spec.md` contains only the final revised spec
  9. verify no review scratch files were written under `thoughts/`
- Log deferred embedded-review work in `thoughts/tech-debt.md`.

## Final Review Expectations

Write `thoughts/tasks/plan-review-integration/impl/final-review.md` after all task reviews pass.

Final review must verify:

- Durable pieces are well factored: review types, prompt, parser, summary UI.
- Disposable pieces are thin: no rich lifecycle/status framework around `plan-review`.
- Renderer/main boundary is preserved.
- `plan-review` is never invoked with `-o claude`.
- `Write to file` persists only spec markdown.
- Review summary is rendered but not persisted into `initial-spec.md`.

## Deferred / Explicitly Out of Scope

- Embedded in-Forge review UI. Reason: v1.0 direction.
- Rich external process lifecycle management. Reason: bridge is demo-only and expected to be replaced.
- `plan-review` Codex output target. Reason: Forge owns model routing.
- Persistent review history under `thoughts/`. Reason: demo goal is clean final spec only.
