# Task 3 QA Review

## Strengths

- The main demo path is wired through the intended preload boundary. `App` calls `window.forge.spec.launchReview(drawerIssueId, content, claudeModel)` and keeps filesystem/process work out of the renderer.
- `SpecTab` passes cleaned displayed markdown to `Launch Review`, disables the launch button while pending, shows `Review in progress...`, and renders the review summary collapsed by default.
- The write path still receives only markdown content; I found no review-summary persistence path into `initial-spec.md`.
- Focused renderer tests cover the required happy/error flows: cleaned launch content, pending disabled/status behavior, collapsed/expanded summary rendering, successful draft replacement, failed-review content preservation, and write-only revised markdown.
- No direct Node/Electron imports were found in `src/renderer`, and no unreasoned `any` was found in the Task 3 implementation surface.

## Issues

### Critical

- None.

### Important

- [src/renderer/app.tsx:123](/Users/alvarocarvalho/desenv/personal/forge/src/renderer/app.tsx:123) applies an async review result without verifying that the drawer is still showing the same issue that launched it. `onLaunchReviewSpec` captures the old `drawerIssueId`, awaits `window.forge.spec.launchReview`, then unconditionally calls `setReviewedContent(result.content)` and `setReviewSummary(result.summary)` at [src/renderer/app.tsx:133](/Users/alvarocarvalho/desenv/personal/forge/src/renderer/app.tsx:133). If the user starts review for `FUL-1`, opens `FUL-2` before the external review/model call resolves, the reset effect at [src/renderer/app.tsx:91](/Users/alvarocarvalho/desenv/personal/forge/src/renderer/app.tsx:91) clears state for the new drawer, but the older promise can later populate `FUL-2` with `FUL-1`'s revised draft and summary. This can lead to writing the wrong revised spec to the currently selected issue. Add a stale-result guard keyed by the requested issue id, and add an app-level regression test where a delayed first review resolves after switching issues.

### Minor

- [src/renderer/components/spec-tab.tsx:164](/Users/alvarocarvalho/desenv/personal/forge/src/renderer/components/spec-tab.tsx:164) renders the collapsed `Review changes` toggle as a plain button without `aria-expanded` or `aria-controls`. The control is keyboard reachable, but assistive tech cannot tell whether the summary region is open. Add those attributes when the stale-result fix touches this area.

## Drift detected

- None. Task 1's prior issues were invalid prompt contract and parser complexity, and Task 2's prior issue was an unused import/lint blocker. The current issue is a new renderer async-state race, not a repeated issue class across prior tasks.

## Assessment

- Result: changes requested.
- Manual demo verification remains accurately reported as not performed in [thoughts/tasks/plan-review-integration/impl/task-3/progress.md](/Users/alvarocarvalho/desenv/personal/forge/thoughts/tasks/plan-review-integration/impl/task-3/progress.md:41).
- Verification run:
  - `npm test -- tests/renderer/spec-tab.test.tsx tests/renderer/app.test.tsx` passed: 2 files / 23 tests.
  - `npm run typecheck` passed.
  - `npm test` passed: 44 files / 208 tests.
  - `npm run lint` passed with 0 errors and 2 warnings outside the Task 3 surface: `src/renderer/hooks/use-spec-stream.ts` unnecessary hook dependency and `tests/main/paths.test.ts` unused `vi` import.
