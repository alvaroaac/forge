# Task 17 Spec Review

## Verdict

✅ Spec compliant

## Evidence

- Plan requirement: Task 17 requires the triage drawer equivalent of Task 16: accept `phase` / `commentCount`, show triaging and generating brief activity before content, hide once content exists, and wire values from `useTriageStream` through `TriageDrawerContainer` (`thoughts/tasks/comment-context-pipeline/plans/2026-05-20-comment-context-pipeline.v2.md`, Task 17).
- Commit reviewed: `1dae183` (`feat(triage-ui): show triaging/generating phase indicator`).
- Progress reviewed: `thoughts/tasks/comment-context-pipeline/impl/task-17/progress.md`.

## Compliance Notes

- `TriageDrawerContainer` destructures `phase` and `commentCount` from `useTriageStream(issue.id)` at `src/renderer/app.tsx:275`, and forwards both into `TriageDrawer` at `src/renderer/app.tsx:290`.
- `TriageDrawer` accepts `phase?: GenerationPhase` and `commentCount?: number` at `src/renderer/components/triage-drawer.tsx:9`.
- The drawer renders `Triaging {commentCount ?? '…'} comment(s)…` for `triaging` and `Generating brief…` for `generating` via `pickPhaseStatus` at `src/renderer/components/triage-drawer.tsx:42`, then passes the merged activity status into `GeneratedDocument` at `src/renderer/components/triage-drawer.tsx:221`.
- The implementation adapts the requested inline row into `GeneratedDocument`'s existing activity status surface. This is acceptable because generated markdown takes precedence over activity status once `content` is non-empty in `GeneratedDocumentBody` (`src/renderer/components/generated-document.tsx:181`), so the phase text is hidden once brief content exists.
- Focused tests cover triaging text, unknown count fallback, generating brief text, hiding after brief content arrives, and App prop forwarding in `tests/renderer/triage-drawer.test.tsx` and `tests/renderer/app.test.tsx`.

## Verification

- `npm run typecheck` — pass.
- `npm test -- tests/renderer/spec-tab.test.tsx tests/renderer/spec-drawer.test.tsx tests/renderer/triage-drawer.test.tsx tests/renderer/app.test.tsx tests/renderer/use-triage-stream.test.ts tests/renderer/use-spec-stream.test.ts` — pass, 6 files / 98 tests.
