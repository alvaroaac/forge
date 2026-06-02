# Task 17 QA Review - Triage phase indicator

## Strengths

- The triage drawer mirrors the Task 16 `GeneratedDocument` activity-status approach, so the new phase text fits the existing generated-document UI instead of adding a redundant row or drawer-specific layout.
- Visibility/hide behavior is correct. `TriageDrawer` sends triage/generating text through `GeneratedDocument` only while the drawer has no brief content; once `streaming` or persisted `brief.content` is non-empty, `GeneratedDocumentBody` renders markdown and hides the activity status.
- The loading path for persisted `triage-brief.md` remains separate. `isCheckingBrief` still shows only `Checking triage-brief.md` and suppresses the normal generate actions, so phase metadata cannot accidentally overwrite the saved-brief loading state.
- Prop threading is narrow and type-safe. `TriageDrawerContainer` destructures `phase` and `commentCount` from `useTriageStream(issue.id)` and forwards them directly to `TriageDrawer` as optional typed props.
- App drawer routing is not regressed. The existing condition still routes triage issues opened via the spec action to `TriageDrawerContainer`, and existing coverage still verifies triage detail opens the normal `SpecDrawer` detail view.
- Tests cover the meaningful renderer surface: triaging, unknown count fallback, generating brief, hide-after-content, App forwarding, and the adjacent drawer-routing cases. That is appropriate coverage for this UI-only task.

## Issues

### Critical

None.

### Important

None.

### Minor

- `src/renderer/components/triage-drawer.tsx` repeats the small `pickStreamStatus` / `pickPhaseStatus` / `pickActivityStatus` helper shape introduced in `src/renderer/components/spec-tab.tsx`. The behavior is correct and the strings differ by document type, so this is not blocking, but a future shared helper could keep the phase-status contract single-sourced if this pattern appears again.

## Drift

No blocking drift detected. Task 17 does not repeat the prior serious drift themes: no weakened API contract, no identifier/UUID confusion, no extra drawer route, and no state-finalization regression. The only small drift is local helper duplication from Task 16, which is contained and does not affect behavior.

## Assessment

Approved with one minor code-quality note. The triage phase indicator is visible only in the no-content activity state, hidden by streamed/saved brief content, safely threaded from the hook, and covered by focused renderer and type checks.

Verification run:
- `npm test -- tests/renderer/spec-tab.test.tsx tests/renderer/spec-drawer.test.tsx tests/renderer/triage-drawer.test.tsx tests/renderer/app.test.tsx tests/renderer/use-triage-stream.test.ts tests/renderer/use-spec-stream.test.ts` - passed, 6 files / 98 tests.
- `npm run typecheck` - passed.
