# Task 16 QA Review - Spec phase indicator

## Strengths

- The UI behavior is implemented through `GeneratedDocument`'s existing activity surface instead of adding a second layout branch or extra inline row. That keeps the spec tab visually consistent with the current generated-document pattern and avoids layout-heavy chrome.
- Visibility/hide behavior is correct for the intended flow. `SpecTab` passes the phase text as the last activity status, and `GeneratedDocumentBody` switches to markdown as soon as `content.trim()` is non-empty, so `Triaging ...` / `Generating spec...` disappear once streamed or saved markdown exists.
- The prop threading is clean and typed. `GenerationPhase` is imported from shared types, `phase?: GenerationPhase` and `commentCount?: number` flow from `useSpecStream(drawerIssueId)` through `App` -> `SpecDrawer` -> `SpecTab`, and no broad `any` or local phase-string union was introduced.
- Existing stream status behavior is preserved. `pickActivityStatus` appends the phase status after existing stream statuses, which means `GeneratedDocumentActivity` still treats the phase as the current line and keeps prior statuses in the existing list.
- App drawer routing is unchanged. The triage-issue/spec-action route still selects `TriageDrawerContainer`, while normal spec/detail routing still goes through `SpecDrawer`.
- Tests cover the meaningful renderer surface for this task: spec tab triaging, unknown count fallback, generating, hide-after-content, drawer prop forwarding, and App prop forwarding. That is enough for this UI-only task alongside type coverage.

## Issues

### Critical

None.

### Important

None.

### Minor

None.

## Drift

No repeated drift pattern detected. Task 16 does not weaken shared contracts, duplicate prompt logic, reintroduce identifier/UUID ambiguity, or repeat the Task 14/15 rejected-generation state bug. The implementation also avoids the plan's visual-risk area by reusing `GeneratedDocument` rather than adding a new custom layout.

## Assessment

Approved. The spec phase indicator is visible in the empty streaming activity state, hidden once document content exists, threaded through typed props, and covered by focused renderer tests.

Verification run:
- `npm test -- tests/renderer/spec-tab.test.tsx tests/renderer/spec-drawer.test.tsx tests/renderer/triage-drawer.test.tsx tests/renderer/app.test.tsx tests/renderer/use-triage-stream.test.ts tests/renderer/use-spec-stream.test.ts` - passed, 6 files / 98 tests.
- `npm run typecheck` - passed.
