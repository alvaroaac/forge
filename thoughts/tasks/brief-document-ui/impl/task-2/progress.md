Status: DONE

What you implemented
- Refactored `SpecTab` to use `GeneratedDocument` for the common generated-artifact surface: artifact path, streaming marker, status/error text, empty state, activity state, and markdown rendering.
- Kept spec-specific behavior in `SpecTab`: saved vs streaming vs reviewed content selection, model picker, review status/error handling, review changes toggle, and launch review/write/copy handlers.
- Preserved spec behavior for `thoughts/tasks/<issue-id>/initial-spec.md`, empty state copy/actions, generation activity, markdown rendering, review action handling, and reviewed content precedence.
- Updated `GeneratedDocument` so populated actions remain visible during activity/streaming states while staying hidden for idle empty states.

Tests run and results
- `npm test -- tests/renderer/spec-tab.test.tsx` red run: failed because the empty document surface did not yet show `thoughts/tasks/FUL-7/initial-spec.md`.
- `npm test -- tests/renderer/spec-tab.test.tsx` red run: failed because the model picker was hidden while generation activity was running.
- `npm test -- tests/renderer/spec-tab.test.tsx tests/renderer/generated-document.test.tsx`: passed, 2 files and 26 tests.
- `npm run typecheck`: passed.
- `npm test`: passed, 56 files and 287 tests.
- `npx eslint src/renderer/components/spec-tab.tsx src/renderer/components/generated-document.tsx --rule 'complexity: ["error", 4]'`: passed.
- `git diff --check`: passed.

Files changed
- `src/renderer/components/spec-tab.tsx`
- `src/renderer/components/generated-document.tsx`
- `tests/renderer/spec-tab.test.tsx`
- `tests/renderer/generated-document.test.tsx`
- `thoughts/tasks/brief-document-ui/impl/task-2/progress.md`

Self-review findings
- Verified `GeneratedDocument` remains presentation-focused and does not contain spec review logic, model selection logic, IPC, persistence, or generator behavior.
- Verified `SpecTab` still owns content precedence and action handler behavior.
- Verified no `any` was introduced.
- Verified focused and full test suites pass.

Tech-debt logged, or none
- None.

Concerns
- None.
