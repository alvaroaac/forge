# Task 19

## Task
Implement `TriageDrawer` renderer component and corresponding tests.

## Files Changed
- `src/renderer/components/triage-drawer.tsx`
- `tests/renderer/triage-drawer.test.tsx`
- `thoughts/tasks/add-triage/impl/task-19/progress.md`

## Implementation Notes
- Added `TriageDrawer` with props: `issue`, `canGenerate`, `isStreaming`, `streaming`, `brief`, `errorMessage`, `onGenerate`, and `onClose`.
- Component renders `null` when no issue is selected.
- Added issue header showing `id` and `title` plus a close button.
- Added brief generation button with disabled state tied to `!canGenerate || isStreaming` and label swap to `Generating...` while streaming.
- Added concise `computronRepoPath`/git repo hint when generation is disabled.
- Added rendering for error text and streamed/generated content.
- Added `Write to file` button gated by `brief` presence.
- Implemented overwrite behavior via:
  - first `window.forge.triage.write(issue.id, brief.content)`
  - if result `{ exists: true, written: false }`, prompt with `window.confirm('Overwrite existing triage-brief.md?')`
  - on confirm, retry with `{ overwrite: true }`

## Tests
- Created `tests/renderer/triage-drawer.test.tsx` covering:
  - `issue === null` render-null behavior
  - generate button disabled state and disabled-copy hint
  - generating label/state
  - streamed/generated content and error rendering
  - write-button visibility only when brief exists
  - overwrite prompt + retry with overwrite flag

Commands run:
- `npm test -- tests/renderer/triage-drawer.test.tsx`
- `npm run typecheck`

## QA Notes
- No intentional tech debt for this task.
