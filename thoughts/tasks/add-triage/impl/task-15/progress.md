# Task 15

## Task
Implement IPC handlers for `triage:generate` and `triage:write`.

## Files Changed
- `src/main/ipc/triage.ts` (new)
- `tests/main/ipc-triage.test.ts` (new)
- `thoughts/tasks/add-triage/impl/task-15/progress.md` (new)

## Validation
- Ran before implementation:
  - `npm test -- tests/main/ipc-triage.test.ts` (failed due to missing `src/main/ipc/triage`)
- Ran after implementation:
  - `npm test -- tests/main/ipc-triage.test.ts` (pass, 4 tests)

## What I Implemented
- Added `registerTriageGenerateHandler`:
  - reads config, requires non-empty `computronRepoPath`
  - loads triage issues via injected `fetchTriageList`
  - validates issue id with triage-specific safe lookup (`isSafeIssueId`)
  - selects requested model or fallback `cfg.claudeModel`
  - calls `streamTriageBrief` with chunk callback
  - sends stream chunk events and `TriageGenerateDone`
  - returns `{ issueId, content }`
  - sends `TriageGenerateError` then rethrows on failure
- Added `registerTriageWriteHandler`:
  - uses `assertSafeIssueId` for writes
  - reads `repoPath` from config
  - writes in `create` mode by default
  - supports `overwrite: true` mode
  - returns `{ issueId, ...result }`

## Commit
- `feat(ipc): triage:generate (streaming) + triage:write (create|overwrite)`

## Tech Debt
- None introduced.
