# Task 16 Spec Review

## Verdict

✅ Spec compliant

## Evidence

- Plan requirement: Task 16 requires spec phase UI for `triaging` and `generating`, forwarding `phase` / `commentCount` through `src/renderer/app.tsx`, `src/renderer/components/spec-drawer.tsx`, and `src/renderer/components/spec-tab.tsx`; the indicator must disappear once content exists (`thoughts/tasks/comment-context-pipeline/plans/2026-05-20-comment-context-pipeline.v2.md`, Task 16).
- Commit reviewed: `3d579f4` (`feat(spec-ui): show triaging/generating phase indicator`).
- Progress reviewed: `thoughts/tasks/comment-context-pipeline/impl/task-16/progress.md`.

## Compliance Notes

- `useSpecStream(drawerIssueId)` now destructures `phase: specPhase` and `commentCount: specCommentCount` in `src/renderer/app.tsx:45`, and forwards both into `SpecDrawer` at `src/renderer/app.tsx:239`.
- `SpecDrawer` accepts `phase?: GenerationPhase` and `commentCount?: number` at `src/renderer/components/spec-drawer.tsx:8`, threads them through `SpecDrawerBody` at `src/renderer/components/spec-drawer.tsx:58`, and passes them into `SpecTab` at `src/renderer/components/spec-drawer.tsx:90`.
- `SpecTab` accepts the two props at `src/renderer/components/spec-tab.tsx:13`, renders `Triaging {commentCount ?? '…'} comment(s)…` for `triaging` and `Generating spec…` for `generating` via `pickPhaseStatus` at `src/renderer/components/spec-tab.tsx:98`, and includes that status in the `GeneratedDocument` activity status at `src/renderer/components/spec-tab.tsx:315`.
- The implementation adapts the requested phase row into `GeneratedDocument`'s existing activity status surface. This is acceptable because `GeneratedDocumentBody` renders activity only when there is no document content, and switches to markdown content once `hasContent` is true (`src/renderer/components/generated-document.tsx:181`), satisfying the "hidden once content exists" requirement.
- Focused tests cover triaging text, unknown count fallback, generating text, hiding after markdown content arrives, drawer prop forwarding, and App prop forwarding in `tests/renderer/spec-tab.test.tsx`, `tests/renderer/spec-drawer.test.tsx`, and `tests/renderer/app.test.tsx`.

## Verification

- `npm run typecheck` — pass.
- `npm test -- tests/renderer/spec-tab.test.tsx tests/renderer/spec-drawer.test.tsx tests/renderer/triage-drawer.test.tsx tests/renderer/app.test.tsx tests/renderer/use-triage-stream.test.ts tests/renderer/use-spec-stream.test.ts` — pass, 6 files / 98 tests.
