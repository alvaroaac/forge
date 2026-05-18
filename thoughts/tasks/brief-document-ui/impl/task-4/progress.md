# Task 4 Progress - Normalize Drawer Shell/Header

Status: DONE_WITH_CONCERNS

## Summary

- Extracted a small shared `IssueDrawerShell` for the common drawer scrim, open drawer frame, close button, issue id/title header, priority, labels, Linear link, optional tabs, and body slot.
- Refactored `SpecDrawer` to use the shared shell while preserving its closed-shell rendering when `issue` is `null`, Escape-to-close behavior, tab behavior, and detail/spec body selection.
- Refactored `TriageDrawer` to use the shared shell while preserving its `null` render behavior, generation/write behavior, and generated brief document rendering.
- Added focused shell tests for closed rendering, unmounted closed rendering, metadata/tabs/link rendering, and close interactions.

## Files Changed

- `src/renderer/components/issue-drawer-shell.tsx`
- `src/renderer/components/spec-drawer.tsx`
- `src/renderer/components/triage-drawer.tsx`
- `tests/renderer/issue-drawer-shell.test.tsx`
- `thoughts/tasks/brief-document-ui/impl/task-4/progress.md`

## Verification

- `npm test -- tests/renderer/issue-drawer-shell.test.tsx tests/renderer/spec-drawer.test.tsx tests/renderer/triage-drawer.test.tsx` - passed, 3 files / 19 tests.
- `npx eslint src/renderer/components/issue-drawer-shell.tsx src/renderer/components/spec-drawer.tsx src/renderer/components/triage-drawer.tsx --rule 'complexity: ["error", 4]'` - passed.
- `npm run typecheck` - passed.
- `npm test -- tests/renderer/issue-drawer-shell.test.tsx tests/renderer/spec-drawer.test.tsx tests/renderer/triage-drawer.test.tsx tests/renderer/app.test.tsx tests/renderer/generated-document.test.tsx` - passed, 5 files / 35 tests.
- `npm test` - passed, 57 files / 292 tests.
- `git diff --check` - passed.
- `rg -n "\bany\b|as any|: any|<any>" src/renderer/components/issue-drawer-shell.tsx src/renderer/components/spec-drawer.tsx src/renderer/components/triage-drawer.tsx tests/renderer/issue-drawer-shell.test.tsx tests/renderer/spec-drawer.test.tsx tests/renderer/triage-drawer.test.tsx` - no matches.
- `rg -n "from ['\"](fs|path|child_process|electron)['\"]|require\(['\"](fs|path|child_process|electron)['\"]\)|ipcRenderer|window\.electron|process\." src/renderer/components/issue-drawer-shell.tsx src/renderer/components/spec-drawer.tsx src/renderer/components/triage-drawer.tsx` - no matches.
- `npm run package:app` - failed during `electron-builder --mac dir` after icon generation and Electron/Vite build completed. Failure: `Cannot compute electron version from installed node modules - none of the possible electron modules are installed and version ("^33.0.0") is not fixed in project.`

## Self-Review

- The extraction stayed presentation-focused and did not move generated document rendering, IPC, persistence, triage write behavior, or spec review behavior into the shell.
- `TriageDrawer` now gets the same normalized issue metadata header as `SpecDrawer`; this is the only intended visible normalization.
- No tech-debt entry was logged. The package failure appears to be an existing packaging configuration/dependency-resolution issue, not intentionally deferred Task 4 scope.

## Commit

- `refactor(ui): share issue drawer shell`
